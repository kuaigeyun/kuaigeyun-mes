"""按销售订单生成制造全流程演示数据（运维造数）。"""

from __future__ import annotations

import asyncio
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Callable, Optional
from zoneinfo import ZoneInfo

from loguru import logger

from core.services.document_time_rewrite_service import (
    DocumentTimeRewriteService,
    WorkScheduleParams,
)
from core.services.logging.operation_log_service import OperationLogService
from core.models.operation_log import OperationLog
from core.utils.timezone_utils import now_utc, resolve_business_datetime, site_timezone_name
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError

ProgressCallback = Callable[[int, str], Any]


STEP_KEYS = (
    "demand_computation",
    "purchase",
    "incoming_inspection",
    "inventory_topup",
    "production_picking",
    "reporting",
    "process_inspection",
    "finished_goods_inspection",
    "finished_goods_receipt",
    "shipment_delivery",
)

# 各步骤默认从这些预设角色码中随机取激活用户（按序尝试）
STEP_DEFAULT_ROLE_CODES: dict[str, tuple[str, ...]] = {
    "demand_computation": ("PRODUCTION_MANAGER", "SALES_MANAGER"),
    "purchase": ("PURCHASE_PERSON", "PURCHASE_MANAGER"),
    "incoming_inspection": ("QUALITY_OPERATOR", "QUALITY_MANAGER"),
    "inventory_topup": ("WAREHOUSE_OPERATOR",),
    "production_picking": ("WAREHOUSE_OPERATOR",),
    "reporting": ("PRODUCTION_STAFF", "PRODUCTION_MANAGER"),
    "process_inspection": ("QUALITY_OPERATOR", "QUALITY_MANAGER"),
    "finished_goods_inspection": ("QUALITY_OPERATOR", "QUALITY_MANAGER"),
    "finished_goods_receipt": ("WAREHOUSE_OPERATOR",),
    "shipment_delivery": ("WAREHOUSE_OPERATOR", "SALES_PERSON"),
}

DEFAULT_INTERVAL_MIN = 300
DEFAULT_INTERVAL_MAX = 1800
DEFAULT_REPORTING_BATCHES_MIN = 2
DEFAULT_REPORTING_BATCHES_MAX = 5
# 工序间流转：须完上道时按标准工时推进；可跳转时用较短间隔
OP_FLOW_GAP_MIN_SECONDS = 600
OP_FLOW_GAP_MAX_SECONDS = 7 * 24 * 3600
OP_JUMP_GAP_RATIO = 0.15  # 可跳转时仅占用上道标准工时的一小段


@dataclass
class IntervalConfig:
    min_seconds: int = DEFAULT_INTERVAL_MIN
    max_seconds: int = DEFAULT_INTERVAL_MAX

    def clamp(self) -> "IntervalConfig":
        lo = max(1, int(self.min_seconds))
        hi = max(lo, int(self.max_seconds))
        return IntervalConfig(min_seconds=lo, max_seconds=hi)


@dataclass
class ReportingBatchConfig:
    """工序报工分批：数量拆多批、每批独立时间与操作人。"""

    min_batches: int = DEFAULT_REPORTING_BATCHES_MIN
    max_batches: int = DEFAULT_REPORTING_BATCHES_MAX

    def clamp(self) -> "ReportingBatchConfig":
        lo = max(1, min(20, int(self.min_batches)))
        hi = max(lo, min(20, int(self.max_batches)))
        return ReportingBatchConfig(min_batches=lo, max_batches=hi)

    def pick_batch_count(self, qty: Decimal) -> int:
        cfg = self.clamp()
        n = random.randint(cfg.min_batches, cfg.max_batches)
        if qty == qty.to_integral_value() and qty >= 1:
            n = min(n, int(qty))
        return max(1, n)


@dataclass
class StepOperatorConfig:
    """单据步骤操作用户配置。

    mode:
      - fixed: 使用 user_id
      - random_role: 从 role_code（或步骤默认角色）下激活用户随机
      - random_department: 从 department_id 下激活用户随机
      - random_team: 从 work_group_id（工作小组）成员随机
      - operation_assigned: 按工单工序派工/工序档案默认人员（报工逐步解析）
      - current: 使用当前登录用户（fallback）
    """

    mode: str = "random_role"
    user_id: Optional[int] = None
    role_code: Optional[str] = None
    department_id: Optional[int] = None
    work_group_id: Optional[int] = None

    def normalized_mode(self) -> str:
        raw = (self.mode or "random_role").strip().lower()
        if raw in ("fixed", "user", "指定", "指定人员"):
            return "fixed"
        if raw in ("current", "self", "当前"):
            return "current"
        if raw in ("random_department", "department", "按部门随机"):
            return "random_department"
        if raw in ("random_team", "team", "work_group", "小组随机"):
            return "random_team"
        if raw in ("operation_assigned", "by_operation", "按工序指定人员", "工序指定"):
            return "operation_assigned"
        if raw in ("equipment_assigned", "设备指定", "设备指定点检人员"):
            return "equipment_assigned"
        if raw in ("scheme_assigned", "方案指定", "方案指定审核人员"):
            return "scheme_assigned"
        return "random_role"


@dataclass
class TimelineEntry:
    step_key: str
    doc_type: str
    doc_id: int
    doc_code: str
    issued_at: datetime
    label: str = ""
    operation_log_id: Optional[int] = None
    note: Optional[str] = None


@dataclass
class FlowGenerateRequest:
    source_type: str = "sales_order"  # sales_order | sales_forecast
    sales_order_id: Optional[int] = None
    sales_forecast_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    anchor_at: Optional[datetime] = None
    intervals: dict[str, IntervalConfig] = field(default_factory=dict)
    default_interval: IntervalConfig = field(
        default_factory=lambda: IntervalConfig(DEFAULT_INTERVAL_MIN, DEFAULT_INTERVAL_MAX)
    )
    steps: dict[str, bool] = field(default_factory=dict)
    step_operators: dict[str, StepOperatorConfig] = field(default_factory=dict)
    reporting_batches: ReportingBatchConfig = field(
        default_factory=lambda: ReportingBatchConfig(
            DEFAULT_REPORTING_BATCHES_MIN, DEFAULT_REPORTING_BATCHES_MAX
        )
    )
    work_schedule: Optional[WorkScheduleParams] = None
    use_work_schedule: bool = False

    def normalized_source(self) -> str:
        raw = (self.source_type or "sales_order").strip().lower()
        if raw in ("sales_forecast", "forecast"):
            return "sales_forecast"
        return "sales_order"


class TimelinePlanner:
    """按间隔随机生成严格递增的业务时刻（含分秒）。"""

    def __init__(
        self,
        *,
        anchor: datetime,
        default_interval: IntervalConfig,
        intervals: dict[str, IntervalConfig],
        work_schedule: Optional[WorkScheduleParams] = None,
        use_work_schedule: bool = False,
    ) -> None:
        self._cursor = resolve_business_datetime(anchor).replace(microsecond=0)
        self._default = default_interval.clamp()
        self._intervals = {k: v.clamp() for k, v in intervals.items()}
        self._schedule = work_schedule
        self._use_schedule = bool(use_work_schedule and work_schedule)
        self._tz = ZoneInfo(site_timezone_name())

    def interval_for(self, step_key: str) -> IntervalConfig:
        return self._intervals.get(step_key, self._default)

    def current(self) -> datetime:
        return self._cursor

    def set_cursor(self, when: datetime) -> None:
        """设置游标（可回拨，用于多工单/可跳转工序并行时间线）。"""
        self._cursor = resolve_business_datetime(when).replace(microsecond=0)

    def bump_to(self, when: datetime) -> None:
        """游标仅向前对齐到 when（取较晚者）。"""
        when_utc = resolve_business_datetime(when).replace(microsecond=0)
        if when_utc > self._cursor:
            self._cursor = when_utc

    def fork(self) -> "TimelinePlanner":
        """复制当前游标与间隔配置，独立推进（多工单并行报工）。"""
        other = TimelinePlanner(
            anchor=self._cursor,
            default_interval=self._default,
            intervals=dict(self._intervals),
            work_schedule=self._schedule,
            use_work_schedule=self._use_schedule,
        )
        other._cursor = self._cursor
        return other

    def next(self, step_key: str) -> datetime:
        cfg = self.interval_for(step_key)
        gap = random.uniform(float(cfg.min_seconds), float(cfg.max_seconds))
        # 额外扰动分秒：在秒级 gap 上再叠 0–59 秒的碎秒感（若 gap 已含秒则仍保证随机）
        gap += random.uniform(0.0, 59.0) * 0.01
        return self.advance_by_seconds(gap)

    def advance_by_seconds(self, seconds: float) -> datetime:
        """按明确秒数推进游标（工序标准工时/流转间隔）。"""
        gap = max(1.0, float(seconds))
        nxt = self._cursor + timedelta(seconds=gap)
        nxt = nxt.replace(microsecond=0)
        if nxt <= self._cursor:
            nxt = self._cursor + timedelta(seconds=1)
        if self._use_schedule and self._schedule is not None:
            site = nxt.astimezone(self._tz)
            site = self._clamp_forward(site)
            nxt = site.astimezone(timezone.utc).replace(microsecond=0)
            if nxt <= self._cursor:
                nxt = self._cursor + timedelta(seconds=1)
        self._cursor = nxt
        return nxt

    def _clamp_forward(self, when_site: datetime) -> datetime:
        """保证落在工作时段内；过晚则推到下一工作日上班时刻。"""
        assert self._schedule is not None
        cur = when_site.replace(microsecond=0)
        day = cur.date()
        for _ in range(400):
            window = self._schedule.window_on(day, self._tz)
            if window is None:
                day += timedelta(days=1)
                continue
            start, end = window
            last = end - timedelta(seconds=1)
            if last < start:
                last = start
            if cur.date() < day:
                return start
            if cur < start:
                return start
            if cur > last:
                day += timedelta(days=1)
                cur = datetime(day.year, day.month, day.day, tzinfo=self._tz)
                continue
            return cur
        return when_site


@dataclass
class _FlowJobRecord:
    job_id: str
    tenant_id: int
    operator_id: int
    status: str = "queued"  # queued | running | succeeded | failed
    progress: int = 0
    message: str = ""
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class FlowGenerateJobService:
    """流程造数异步任务（进程内状态；POST 立即返回，避免网关 504）。"""

    _jobs: dict[str, _FlowJobRecord] = {}
    _lock = asyncio.Lock()

    @classmethod
    def create(
        cls, *, tenant_id: int, operator_id: int
    ) -> _FlowJobRecord:
        job_id = str(uuid.uuid4())
        rec = _FlowJobRecord(
            job_id=job_id, tenant_id=tenant_id, operator_id=operator_id
        )
        cls._jobs[job_id] = rec
        return rec

    @classmethod
    def get(cls, *, tenant_id: int, job_id: str) -> Optional[_FlowJobRecord]:
        rec = cls._jobs.get(job_id)
        if not rec or rec.tenant_id != tenant_id:
            return None
        return rec

    @classmethod
    def update(
        cls,
        job_id: str,
        *,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        result: Optional[dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        rec = cls._jobs.get(job_id)
        if not rec:
            return
        if status is not None:
            rec.status = status
        if progress is not None:
            rec.progress = max(0, min(100, int(progress)))
        if message is not None:
            rec.message = message
        if result is not None:
            rec.result = result
        if error is not None:
            rec.error = error
        rec.updated_at = datetime.now(timezone.utc)

    @classmethod
    def to_dict(cls, rec: _FlowJobRecord) -> dict[str, Any]:
        return {
            "job_id": rec.job_id,
            "status": rec.status,
            "progress": rec.progress,
            "message": rec.message or None,
            "result": rec.result,
            "error": rec.error,
            "created_at": rec.created_at.isoformat(),
            "updated_at": rec.updated_at.isoformat(),
        }


class FlowDataGenerateService:
    """销售订单 → 制造/采购/质检/出库 全流程造数编排。"""

    async def list_eligible_orders(
        self,
        tenant_id: int,
        *,
        keyword: str = "",
        limit: int = 50,
    ) -> dict[str, Any]:
        from tortoise.expressions import Q

        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES, ORDER_PUSHABLE_STATUSES
        from apps.kuaizhizao.models.sales_order import SalesOrder

        qs = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True).filter(
            Q(status__in=tuple(ORDER_PUSHABLE_STATUSES))
            | Q(status__in=tuple(LEGACY_AUDITED_VALUES))
        )
        kw = (keyword or "").strip()
        if kw:
            qs = qs.filter(
                Q(order_code__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(order_name__icontains=kw)
            )
        rows = await qs.order_by("-id").limit(max(1, min(int(limit), 200))).all()
        items: list[dict[str, Any]] = []
        for row in rows:
            pushed = bool(getattr(row, "planning_pushed_to_computation", False))
            items.append(
                {
                    "id": int(row.id),
                    "order_code": row.order_code,
                    "order_name": getattr(row, "order_name", None),
                    "customer_name": getattr(row, "customer_name", None),
                    "status": row.status,
                    "order_date": str(row.order_date) if row.order_date else None,
                    "planning_pushed_to_computation": pushed,
                    "eligible": not pushed,
                    "block_reason": (
                        "已下推需求计算，请选择未下推的销售订单" if pushed else None
                    ),
                }
            )
        return {"items": items, "total": len(items)}

    async def list_eligible_forecasts(
        self,
        tenant_id: int,
        *,
        keyword: str = "",
        limit: int = 50,
    ) -> dict[str, Any]:
        from tortoise.expressions import Q

        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES, ORDER_PUSHABLE_STATUSES
        from apps.kuaizhizao.models.sales_forecast import SalesForecast

        qs = SalesForecast.filter(tenant_id=tenant_id, deleted_at__isnull=True).filter(
            Q(status__in=tuple(ORDER_PUSHABLE_STATUSES))
            | Q(status__in=tuple(LEGACY_AUDITED_VALUES))
        )
        kw = (keyword or "").strip()
        if kw:
            qs = qs.filter(
                Q(forecast_code__icontains=kw)
                | Q(forecast_name__icontains=kw)
            )
        rows = await qs.order_by("-id").limit(max(1, min(int(limit), 200))).all()
        items: list[dict[str, Any]] = []
        for row in rows:
            pushed = bool(getattr(row, "planning_pushed_to_computation", False))
            items.append(
                {
                    "id": int(row.id),
                    "forecast_code": row.forecast_code,
                    "forecast_name": getattr(row, "forecast_name", None),
                    "forecast_period": getattr(row, "forecast_period", None),
                    "status": row.status,
                    "start_date": str(row.start_date) if getattr(row, "start_date", None) else None,
                    "end_date": str(row.end_date) if getattr(row, "end_date", None) else None,
                    "planning_pushed_to_computation": pushed,
                    "eligible": not pushed,
                    "block_reason": (
                        "已下推需求计算，请选择未下推的销售预测" if pushed else None
                    ),
                }
            )
        return {"items": items, "total": len(items)}

    @staticmethod
    def _operation_flow_gap_seconds(
        *,
        prev_op: dict[str, Any],
        next_op: dict[str, Any],
        quantity: Decimal,
        reporting_cfg: IntervalConfig,
    ) -> float:
        """工序间业务时刻间隔（秒）。

        须完上道：按上道准备+标准工时×数量；可跳转：仅占上道工时的一小段。
        未维护工时时回退报工步骤间隔随机值。
        """
        from apps.kuaizhizao.utils.work_order_operation_scheduling import (
            operation_total_hours,
        )

        hours = operation_total_hours(
            prev_op.get("setup_time"),
            prev_op.get("standard_time"),
            quantity,
        )
        cfg = reporting_cfg.clamp() if hasattr(reporting_cfg, "clamp") else reporting_cfg
        if hours <= 0:
            return float(random.uniform(float(cfg.min_seconds), float(cfg.max_seconds)))
        seconds = float(hours) * 3600.0
        if bool(next_op.get("allow_jump")):
            seconds *= OP_JUMP_GAP_RATIO
        return max(float(OP_FLOW_GAP_MIN_SECONDS), min(float(OP_FLOW_GAP_MAX_SECONDS), seconds))

    @staticmethod
    def _normalize_preview_operation(raw: dict[str, Any], index: int) -> dict[str, Any]:
        seq = raw.get("sequence")
        try:
            sequence = int(seq) if seq is not None else index + 1
        except (TypeError, ValueError):
            sequence = index + 1
        return {
            "code": raw.get("code") or raw.get("operation_code"),
            "name": raw.get("name") or raw.get("operation_name") or f"工序{sequence}",
            "sequence": sequence,
            "allow_jump": bool(raw.get("allow_jump") if raw.get("allow_jump") is not None else raw.get("allowJump")),
            "standard_time": raw.get("standard_time"),
            "setup_time": raw.get("setup_time"),
        }

    @classmethod
    def _ops_from_operation_sequence(cls, seq: Any) -> list[dict[str, Any]]:
        if not seq:
            return []
        if isinstance(seq, dict):
            ops = seq.get("operations")
            if isinstance(ops, list) and ops:
                ordered = ops
                seq_uuids = seq.get("sequence")
                if isinstance(seq_uuids, list) and seq_uuids:
                    by_uuid: dict[str, dict[str, Any]] = {}
                    for op in ops:
                        if not isinstance(op, dict):
                            continue
                        uid = op.get("uuid") or op.get("operation_uuid")
                        if uid:
                            by_uuid[str(uid)] = op
                    rebuilt = [by_uuid[str(u)] for u in seq_uuids if str(u) in by_uuid]
                    if rebuilt:
                        ordered = rebuilt
                return [
                    cls._normalize_preview_operation(op, i)
                    for i, op in enumerate(ordered)
                    if isinstance(op, dict)
                ]
            return []
        if isinstance(seq, list):
            out: list[dict[str, Any]] = []
            for i, item in enumerate(seq):
                if isinstance(item, dict):
                    out.append(cls._normalize_preview_operation(item, i))
            return out
        return []

    async def _resolve_source_process_operations(
        self,
        tenant_id: int,
        source: str,
        doc: Any,
    ) -> dict[str, Any]:
        """从源单据首个可解析工艺的物料取工序序列，供预览展开报工节点。"""
        from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from apps.master_data.models.material import Material
        from apps.master_data.services.material_product_process_service import (
            MaterialProductProcessService,
        )

        empty: dict[str, Any] = {
            "operations": [],
            "quantity": Decimal("1"),
            "material_code": None,
        }
        if source == "sales_forecast":
            items = (
                await SalesForecastItem.filter(
                    tenant_id=tenant_id,
                    forecast_id=int(doc.id),
                    deleted_at__isnull=True,
                )
                .order_by("id")
                .all()
            )
            qty_attr = "forecast_quantity"
        else:
            items = (
                await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id=int(doc.id),
                    deleted_at__isnull=True,
                )
                .order_by("id")
                .all()
            )
            qty_attr = "order_quantity"
        if not items:
            return empty

        for item in items:
            material_id = int(getattr(item, "material_id", 0) or 0)
            if material_id <= 0:
                continue
            try:
                seq, _allow = await MaterialProductProcessService.resolve_sequence_for_material(
                    tenant_id, material_id
                )
            except Exception as exc:
                logger.info(
                    "flow_generate preview resolve sequence material={}: {}",
                    material_id,
                    exc,
                )
                continue
            operations = self._ops_from_operation_sequence(seq)
            if not operations:
                continue
            material = await Material.get_or_none(
                id=material_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            qty_raw = getattr(item, qty_attr, None)
            try:
                qty = Decimal(str(qty_raw if qty_raw is not None else 1))
            except Exception:
                qty = Decimal("1")
            if qty <= 0:
                qty = Decimal("1")
            code = None
            if material:
                code = getattr(material, "main_code", None) or getattr(material, "code", None)
            if not code:
                code = getattr(item, "material_code", None)
            return {
                "operations": operations,
                "quantity": qty,
                "material_code": str(code) if code else None,
            }
        return empty

    async def preview(
        self,
        tenant_id: int,
        req: FlowGenerateRequest,
    ) -> dict[str, Any]:
        source = req.normalized_source()
        if source == "sales_forecast":
            doc = await self._load_and_validate_sales_forecast(tenant_id, int(req.sales_forecast_id or 0))
            doc_id = int(doc.id)
            doc_code = str(doc.forecast_code)
            anchor_src = getattr(doc, "created_at", None)
        else:
            doc = await self._load_and_validate_sales_order(tenant_id, int(req.sales_order_id or 0))
            doc_id = int(doc.id)
            doc_code = str(doc.order_code)
            anchor_src = getattr(doc, "created_at", None)
        warehouse = await self._resolve_warehouse(tenant_id, req.warehouse_id)
        enabled = self._enabled_steps(req.steps)
        planned_steps = self._planned_step_labels(enabled)
        # 销售预测无销售订单发货链时，预览仍保留步骤标签，执行阶段会走预测出库
        anchor = resolve_business_datetime(req.anchor_at or anchor_src)
        planner = TimelinePlanner(
            anchor=anchor,
            default_interval=req.default_interval,
            intervals=req.intervals,
            work_schedule=req.work_schedule,
            use_work_schedule=req.use_work_schedule,
        )
        op_plan = await self._resolve_source_process_operations(tenant_id, source, doc)
        preview_times: list[dict[str, Any]] = []
        for key, label in planned_steps:
            if key == "reporting" and op_plan.get("operations"):
                ops_list = op_plan["operations"]
                qty = Decimal(str(op_plan.get("quantity") or 1))
                for idx, op in enumerate(ops_list):
                    if idx == 0:
                        issued = planner.next("reporting")
                    else:
                        gap = self._operation_flow_gap_seconds(
                            prev_op=ops_list[idx - 1],
                            next_op=op,
                            quantity=qty,
                            reporting_cfg=req.intervals.get("reporting") or req.default_interval,
                        )
                        issued = planner.advance_by_seconds(gap)
                    flow_mode = (
                        "可跳转"
                        if bool(op.get("allow_jump"))
                        else "须完上道"
                    )
                    preview_times.append(
                        {
                            "step_key": "reporting",
                            "label": f"工序报工-{op.get('name') or op.get('code') or idx + 1}",
                            "issued_at": issued.isoformat(),
                            "operation_sequence": int(op.get("sequence") or idx + 1),
                            "operation_code": op.get("code"),
                            "operation_name": op.get("name"),
                            "flow_mode": flow_mode,
                            "note": (
                                f"流转={flow_mode}"
                                f"；标准工时={op.get('standard_time') or '-'}h/件"
                                f"；准备={op.get('setup_time') or '-'}h"
                            ),
                        }
                    )
                continue
            issued = planner.next(key)
            preview_times.append(
                {
                    "step_key": key,
                    "label": label,
                    "issued_at": issued.isoformat(),
                }
            )
        warnings = self._preview_warnings(doc, enabled, source_type=source)
        if enabled.get("reporting", True) and op_plan.get("operations"):
            warnings.append(
                "工序报工按工艺流转：须完上道则按上道标准工时推进时刻；"
                "可跳转工序使用较短间隔。预览已展开各工序时间节点。"
            )
        elif enabled.get("reporting", True) and not op_plan.get("operations"):
            warnings.append(
                "未解析到源单据物料工艺工序，预览仅显示报工步骤总节点；"
                "执行时将按工单实际工序与流转规则间隔报工。"
            )
        return {
            "source_type": source,
            "sales_order_id": doc_id if source == "sales_order" else None,
            "sales_forecast_id": doc_id if source == "sales_forecast" else None,
            "order_code": doc_code,
            "warehouse_id": warehouse["id"],
            "warehouse_name": warehouse["name"],
            "anchor_at": anchor.isoformat(),
            "steps": preview_times,
            "process_operations": op_plan.get("operations") or [],
            "process_material_code": op_plan.get("material_code"),
            "warnings": warnings,
        }

    async def _emit_progress(
        self,
        progress_cb: Optional[ProgressCallback],
        pct: int,
        message: str,
    ) -> None:
        if not progress_cb:
            return
        maybe = progress_cb(max(0, min(100, int(pct))), message)
        if asyncio.iscoroutine(maybe):
            await maybe

    async def execute(
        self,
        tenant_id: int,
        operator_id: int,
        req: FlowGenerateRequest,
        progress_cb: Optional[ProgressCallback] = None,
    ) -> dict[str, Any]:
        run_id = str(uuid.uuid4())
        source = req.normalized_source()
        sales_order = None
        sales_forecast = None
        if source == "sales_forecast":
            sales_forecast = await self._load_and_validate_sales_forecast(
                tenant_id, int(req.sales_forecast_id or 0)
            )
            doc_id = int(sales_forecast.id)
            doc_code = str(sales_forecast.forecast_code)
            anchor_src = getattr(sales_forecast, "created_at", None)
        else:
            sales_order = await self._load_and_validate_sales_order(
                tenant_id, int(req.sales_order_id or 0)
            )
            doc_id = int(sales_order.id)
            doc_code = str(sales_order.order_code)
            anchor_src = getattr(sales_order, "created_at", None)

        warehouse = await self._resolve_warehouse(tenant_id, req.warehouse_id)
        enabled = self._enabled_steps(req.steps)
        anchor = resolve_business_datetime(req.anchor_at or anchor_src)
        planner = TimelinePlanner(
            anchor=anchor,
            default_interval=req.default_interval,
            intervals=req.intervals,
            work_schedule=req.work_schedule,
            use_work_schedule=req.use_work_schedule,
        )

        timeline: list[TimelineEntry] = []
        step_results: list[dict[str, Any]] = []
        outsource_notes: list[str] = []
        skipped_errors: list[str] = []
        demand_id: Optional[int] = None
        # 需求计算/下推成功后进入「可跳过单项」阶段：单项失败不撤销已写入
        item_phase = False
        await self._emit_progress(progress_cb, 2, "解析步骤操作人")
        ops, op_notes = await self._resolve_step_operators(
            tenant_id=tenant_id,
            fallback_user_id=operator_id,
            step_operators=req.step_operators,
            enabled=enabled,
        )
        outsource_notes.extend(op_notes)
        reporting_cfg = req.step_operators.get("reporting") or StepOperatorConfig()
        reporting_pool = await self._resolve_operator_pool_for_step(
            tenant_id=tenant_id,
            step_key="reporting",
            cfg=reporting_cfg,
            fallback_user_id=ops.get("reporting", operator_id),
        )
        if reporting_cfg.normalized_mode() == "operation_assigned":
            outsource_notes.append(
                "reporting: 按工序指定人员——各工单工序优先用派工人员，其次工序档案默认人员"
            )
        elif len(reporting_pool) > 1:
            outsource_notes.append(
                f"reporting: 报工操作人池 {len(reporting_pool)} 人，将按批次轮换"
            )

        try:
            # 1) 需求计算
            await self._emit_progress(progress_cb, 8, "需求计算")
            if enabled.get("demand_computation", True):
                if source == "sales_forecast":
                    computation_id, demand_id = await self._step_push_and_execute_computation_from_forecast(
                        tenant_id=tenant_id,
                        operator_id=ops["demand_computation"],
                        sales_forecast_id=doc_id,
                        planner=planner,
                        timeline=timeline,
                        step_results=step_results,
                        run_id=run_id,
                    )
                else:
                    computation_id, demand_id = await self._step_push_and_execute_computation(
                        tenant_id=tenant_id,
                        operator_id=ops["demand_computation"],
                        sales_order_id=doc_id,
                        planner=planner,
                        timeline=timeline,
                        step_results=step_results,
                        run_id=run_id,
                    )
            else:
                raise BusinessLogicError("需求计算步骤为必选，无法关闭")

            # 2) 一键下推工单 + 采购单
            await self._emit_progress(progress_cb, 18, "下推工单与采购单")
            push_results = await self._step_push_orders(
                tenant_id=tenant_id,
                operator_id=ops["demand_computation"],
                computation_id=computation_id,
                planner=planner,
                timeline=timeline,
                step_results=step_results,
                run_id=run_id,
                enable_purchase=enabled.get("purchase", True),
            )
            work_orders = push_results.get("work_orders") or []
            purchase_orders = push_results.get("purchase_orders") or []
            for warn in push_results.get("push_warnings") or []:
                outsource_notes.append(str(warn))
            for owo in push_results.get("outsource_work_orders") or []:
                code = owo.get("code") or owo.get("id")
                outsource_notes.append(f"委外工单 {code} 已生成，本版不自动走委外收发，需人工处理")

            item_phase = True

            # 3) 采购：按单处理，失败跳过该 PO，其余继续
            if enabled.get("purchase", True) and purchase_orders:
                await self._emit_progress(progress_cb, 28, "采购审核与入库")
                approved_pos = await self._step_approve_purchase_orders(
                    tenant_id=tenant_id,
                    operator_id=ops["purchase"],
                    purchase_orders=purchase_orders,
                    step_results=step_results,
                    skipped_errors=skipped_errors,
                )
                if approved_pos:
                    if enabled.get("incoming_inspection", True):
                        await self._step_incoming_inspection(
                            tenant_id=tenant_id,
                            operator_id=ops["incoming_inspection"],
                            purchase_orders=approved_pos,
                            warehouse=warehouse,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                            skipped_errors=skipped_errors,
                        )
                    else:
                        await self._step_purchase_direct_receipt(
                            tenant_id=tenant_id,
                            operator_id=ops["purchase"],
                            purchase_orders=approved_pos,
                            warehouse=warehouse,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                            skipped_errors=skipped_errors,
                        )

            # 4) 生产链（按工单）：单张失败跳过，其余继续
            wo_total = max(1, len([w for w in work_orders if int(w.get("id") or 0) > 0]))
            wo_idx = 0
            for wo in work_orders:
                wo_id = int(wo.get("id") or 0)
                if wo_id <= 0:
                    continue
                wo_idx += 1
                wo_code = str(wo.get("code") or wo_id)
                pct = 35 + int(50 * (wo_idx - 1) / wo_total)
                await self._emit_progress(
                    progress_cb,
                    pct,
                    f"生产链 工单 {wo_code}（{wo_idx}/{wo_total}）",
                )
                try:
                    if enabled.get("inventory_topup", True):
                        await self._step_inventory_topup(
                            tenant_id=tenant_id,
                            operator_id=ops["inventory_topup"],
                            work_order_id=wo_id,
                            warehouse=warehouse,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                    if enabled.get("production_picking", True):
                        await self._step_picking(
                            tenant_id=tenant_id,
                            operator_id=ops["production_picking"],
                            work_order_id=wo_id,
                            warehouse=warehouse,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                    if enabled.get("reporting", True):
                        await self._step_reporting(
                            tenant_id=tenant_id,
                            operator_id=ops["reporting"],
                            operator_pool=reporting_pool,
                            operator_cfg=req.step_operators.get("reporting")
                            or StepOperatorConfig(),
                            batch_cfg=req.reporting_batches.clamp(),
                            work_order_id=wo_id,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                    if enabled.get("process_inspection", True):
                        await self._step_process_inspection(
                            tenant_id=tenant_id,
                            operator_id=ops["process_inspection"],
                            work_order_id=wo_id,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                    if enabled.get("finished_goods_inspection", True):
                        await self._step_fqc(
                            tenant_id=tenant_id,
                            operator_id=ops["finished_goods_inspection"],
                            work_order_id=wo_id,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                    if enabled.get("finished_goods_receipt", True):
                        await self._step_fg_receipt(
                            tenant_id=tenant_id,
                            operator_id=ops["finished_goods_receipt"],
                            work_order_id=wo_id,
                            warehouse=warehouse,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                except Exception as exc:
                    msg = str(exc).strip() or exc.__class__.__name__
                    logger.warning("flow-generate skip work order {}: {}", wo_code, exc)
                    self._append_skip(
                        step_results=step_results,
                        skipped_errors=skipped_errors,
                        step_key="reporting",
                        label=f"工单 {wo_code}",
                        message=msg,
                    )
                    continue

            # 5) 发货 / 出库：失败记入跳过，不撤销已写生产/采购
            if enabled.get("shipment_delivery", True):
                await self._emit_progress(progress_cb, 88, "发货出库")
                try:
                    if source == "sales_forecast":
                        await self._step_shipment_delivery_from_forecast(
                            tenant_id=tenant_id,
                            operator_id=ops["shipment_delivery"],
                            sales_forecast_id=doc_id,
                            warehouse=warehouse,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                    else:
                        await self._step_shipment_delivery(
                            tenant_id=tenant_id,
                            operator_id=ops["shipment_delivery"],
                            sales_order_id=doc_id,
                            warehouse=warehouse,
                            planner=planner,
                            timeline=timeline,
                            step_results=step_results,
                            run_id=run_id,
                        )
                except Exception as exc:
                    msg = str(exc).strip() or exc.__class__.__name__
                    logger.warning("flow-generate skip shipment: {}", exc)
                    self._append_skip(
                        step_results=step_results,
                        skipped_errors=skipped_errors,
                        step_key="shipment_delivery",
                        label="发货/出库",
                        message=msg,
                    )

            # 改写时间 + 日志回写（已写入单据保留；跳过项不影响）
            await self._emit_progress(progress_cb, 94, "改写业务时间与操作日志")
            if timeline:
                await self._rewrite_timeline(tenant_id, timeline)
                await self._align_operation_logs(timeline)
            await self._emit_progress(progress_cb, 100, "完成")

        except Exception as exc:
            # 仅需求计算/下推等基础阶段失败才整轮撤销；单项阶段已跳过不会进这里
            logger.exception("flow-generate failed: {}", exc)
            if item_phase:
                # 不应到达；若意外抛出，仍保留已写入，汇总为跳过错误后返回
                msg = str(exc).strip() or exc.__class__.__name__
                self._append_skip(
                    step_results=step_results,
                    skipped_errors=skipped_errors,
                    step_key="demand_computation",
                    label="流程造数",
                    message=msg,
                )
                if timeline:
                    try:
                        await self._rewrite_timeline(tenant_id, timeline)
                        await self._align_operation_logs(timeline)
                    except Exception as rewrite_exc:
                        logger.warning("flow-generate rewrite after partial: {}", rewrite_exc)
            else:
                revert_notes = await self._revert_failed_run(
                    tenant_id=tenant_id,
                    demand_id=demand_id,
                    timeline=timeline,
                )
                detail = str(exc).strip() or exc.__class__.__name__
                if revert_notes:
                    detail = f"{detail}；回滚提示：{'；'.join(revert_notes[:5])}"
                raise BusinessLogicError(
                    f"流程造数未通过，请修改后重试（本轮写入已撤销）：{detail}"
                ) from exc

        return {
            "success": True,
            "run_id": run_id,
            "source_type": source,
            "sales_order_id": doc_id if source == "sales_order" else None,
            "sales_forecast_id": doc_id if source == "sales_forecast" else None,
            "order_code": doc_code,
            "warehouse_id": warehouse["id"],
            "warehouse_name": warehouse["name"],
            "steps": step_results,
            "timeline": [
                {
                    "step_key": t.step_key,
                    "doc_type": t.doc_type,
                    "doc_id": t.doc_id,
                    "doc_code": t.doc_code,
                    "label": t.label,
                    "issued_at": t.issued_at.isoformat(),
                    "operation_log_id": t.operation_log_id,
                    "note": t.note,
                }
                for t in timeline
            ],
            "outsource_notes": outsource_notes,
            "operators": ops,
            "errors": skipped_errors,
            "skipped_count": len(skipped_errors),
        }

    # ── helpers ──────────────────────────────────────────────

    def _enabled_steps(self, steps: dict[str, bool]) -> dict[str, bool]:
        enabled = {k: True for k in STEP_KEYS}
        for k, v in (steps or {}).items():
            if k in enabled:
                enabled[k] = bool(v)
        return enabled

    @staticmethod
    def _append_skip(
        *,
        step_results: list[dict[str, Any]],
        skipped_errors: list[str],
        step_key: str,
        label: str,
        message: str,
    ) -> None:
        """单项失败：记入步骤结果与 errors，不中断整轮。"""
        text = f"{label}: {message}"
        skipped_errors.append(text)
        step_results.append(
            {
                "step_key": step_key,
                "status": "skipped",
                "label": label,
                "message": message,
                "note": "不通过已跳过，其余继续",
            }
        )

    def _is_already_done_error(self, exc: BaseException) -> bool:
        text = str(exc or "")
        markers = ("已审核", "已确认", "已过账", "已入库", "已出库", "已检验", "无需", "不需要")
        return any(m in text for m in markers)

    async def _soft_delete_generated_doc(
        self, tenant_id: int, doc_type: str, doc_id: int
    ) -> None:
        """尽力软删本轮造数单据（库存已过账的下游撤回可能失败，由上层汇总提示）。"""
        if doc_id <= 0:
            return
        now = resolve_business_datetime()
        model = None
        dtype = (doc_type or "").strip()
        if dtype == "work_order":
            from apps.kuaizhizao.models.work_order import WorkOrder

            model = WorkOrder
        elif dtype == "outsource_work_order":
            from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

            model = OutsourceWorkOrder
        elif dtype == "purchase_order":
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder

            model = PurchaseOrder
        elif dtype == "purchase_receipt":
            from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

            model = PurchaseReceipt
        elif dtype == "incoming_inspection":
            from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

            model = IncomingInspection
        elif dtype == "process_inspection":
            from apps.kuaizhizao.models.process_inspection import ProcessInspection

            model = ProcessInspection
        elif dtype == "reporting_record":
            from apps.kuaizhizao.models.reporting_record import ReportingRecord

            model = ReportingRecord
        elif dtype == "finished_goods_inspection":
            from apps.kuaizhizao.models.finished_goods_inspection import (
                FinishedGoodsInspection,
            )

            model = FinishedGoodsInspection
        elif dtype == "finished_goods_receipt":
            from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt

            model = FinishedGoodsReceipt
        elif dtype == "shipment_notice":
            from apps.kuaizhizao.models.shipment_notice import ShipmentNotice

            model = ShipmentNotice
        elif dtype == "sales_delivery":
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery

            model = SalesDelivery
        elif dtype in ("other_inbound", "inventory_topup"):
            from apps.kuaizhizao.models.other_inbound import OtherInbound

            model = OtherInbound
        elif dtype == "production_picking":
            from apps.kuaizhizao.models.production_picking import ProductionPicking

            model = ProductionPicking
        if model is None:
            return
        await model.filter(tenant_id=tenant_id, id=doc_id, deleted_at__isnull=True).update(
            deleted_at=now
        )

    async def _revert_failed_run(
        self,
        *,
        tenant_id: int,
        demand_id: Optional[int],
        timeline: list[TimelineEntry],
    ) -> list[str]:
        """失败时撤销本轮写入：先软删时间线单据，再撤回需求计算（级联未执行下游）。"""
        notes: list[str] = []
        for entry in reversed(timeline):
            try:
                await self._soft_delete_generated_doc(
                    tenant_id, entry.doc_type, int(entry.doc_id)
                )
            except Exception as exc:
                notes.append(
                    f"{entry.doc_type}#{entry.doc_id} 清理失败: {exc}"
                )
        if demand_id:
            try:
                from apps.kuaizhizao.services.demand_service import DemandService

                await DemandService().withdraw_from_computation(
                    tenant_id=tenant_id, demand_id=int(demand_id)
                )
            except Exception as exc:
                notes.append(f"撤回需求计算失败: {exc}")
        return notes

    async def _resolve_step_operators(
        self,
        *,
        tenant_id: int,
        fallback_user_id: int,
        step_operators: dict[str, StepOperatorConfig],
        enabled: dict[str, bool],
    ) -> tuple[dict[str, int], list[str]]:
        """解析各步骤操作用户；无可用角色用户时回退当前登录用户。"""
        notes: list[str] = []
        resolved: dict[str, int] = {}
        for key in STEP_KEYS:
            cfg = step_operators.get(key) or StepOperatorConfig()
            user_id, note = await self._pick_operator_for_step(
                tenant_id=tenant_id,
                step_key=key,
                cfg=cfg,
                fallback_user_id=fallback_user_id,
            )
            resolved[key] = user_id
            if note and enabled.get(key, True):
                notes.append(note)
        return resolved, notes

    async def _pick_operator_for_step(
        self,
        *,
        tenant_id: int,
        step_key: str,
        cfg: StepOperatorConfig,
        fallback_user_id: int,
    ) -> tuple[int, Optional[str]]:
        from infra.models.user import User

        mode = cfg.normalized_mode()
        if mode == "current":
            return int(fallback_user_id), None

        if mode in ("equipment_assigned", "scheme_assigned"):
            return (
                int(fallback_user_id),
                f"{step_key}: 主数据指定人员仅用于设备点检造数，已回退当前用户",
            )

        if mode == "fixed":
            uid = int(cfg.user_id or 0)
            if uid <= 0:
                return int(fallback_user_id), f"{step_key}: 未指定人员，已使用当前用户"
            user = await User.get_or_none(
                id=uid, tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
            )
            if not user:
                # 平台超管可能无 tenant_id 对齐，再按 id 兜底
                user = await User.get_or_none(id=uid, deleted_at__isnull=True, is_active=True)
            if not user:
                return int(fallback_user_id), f"{step_key}: 指定用户 #{uid} 不可用，已回退当前用户"
            return int(user.id), None

        if mode == "random_department":
            dept_id = int(cfg.department_id or 0)
            if dept_id <= 0:
                return int(fallback_user_id), f"{step_key}: 未选择部门，已回退当前用户"
            candidates = await self._list_active_user_ids_by_department(tenant_id, dept_id)
            if not candidates:
                return (
                    int(fallback_user_id),
                    f"{step_key}: 部门 #{dept_id} 下无激活用户，已回退当前用户",
                )
            picked = int(random.choice(candidates))
            return picked, f"{step_key}: 随机选用用户 #{picked}（部门 #{dept_id}）"

        if mode == "random_team":
            team_id = int(cfg.work_group_id or 0)
            if team_id <= 0:
                return int(fallback_user_id), f"{step_key}: 未选择工作小组，已回退当前用户"
            candidates = await self._list_active_user_ids_by_work_group(tenant_id, team_id)
            if not candidates:
                return (
                    int(fallback_user_id),
                    f"{step_key}: 小组 #{team_id} 下无激活成员，已回退当前用户",
                )
            picked = int(random.choice(candidates))
            return picked, f"{step_key}: 随机选用用户 #{picked}（小组 #{team_id}）"

        if mode == "operation_assigned":
            candidates = await self._list_active_user_ids_from_operation_defaults(tenant_id)
            if not candidates:
                return (
                    int(fallback_user_id),
                    f"{step_key}: 工序档案无默认生产人员，已回退当前用户；报工将按工单工序派工解析",
                )
            picked = int(random.choice(candidates))
            return (
                picked,
                f"{step_key}: 预选用户 #{picked}（工序默认人员）；报工按各工序派工",
            )

        # random_role
        role_codes: list[str] = []
        if (cfg.role_code or "").strip():
            role_codes.append((cfg.role_code or "").strip())
        role_codes.extend(STEP_DEFAULT_ROLE_CODES.get(step_key, ()))
        # 去重保序
        seen: set[str] = set()
        uniq_codes: list[str] = []
        for code in role_codes:
            key = code.upper()
            if key in seen:
                continue
            seen.add(key)
            uniq_codes.append(code)

        candidates = await self._list_active_user_ids_by_role_codes(tenant_id, uniq_codes)
        if not candidates:
            codes_txt = "/".join(uniq_codes) or "(无角色)"
            return (
                int(fallback_user_id),
                f"{step_key}: 角色 {codes_txt} 下无激活用户，已回退当前用户",
            )
        picked = int(random.choice(candidates))
        return picked, f"{step_key}: 随机选用用户 #{picked}（角色 {', '.join(uniq_codes)}）"

    async def _list_active_user_ids_by_role_codes(
        self, tenant_id: int, role_codes: list[str]
    ) -> list[int]:
        if not role_codes:
            return []
        from core.models.role import Role
        from core.models.user_role import UserRole
        from infra.models.user import User

        upper = [c.upper() for c in role_codes]
        roles = await Role.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        role_ids = [
            int(r.id)
            for r in roles
            if (getattr(r, "code", None) or "").strip().upper() in upper
        ]
        if not role_ids:
            # 兼容大小写不敏感 / 中文名：再按 code__in 原值试一次
            role_ids = list(
                await Role.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    is_active=True,
                    code__in=role_codes,
                ).values_list("id", flat=True)
            )
        if not role_ids:
            return []
        user_ids = await UserRole.filter(role_id__in=role_ids).values_list("user_id", flat=True)
        if not user_ids:
            return []
        active = await User.filter(
            id__in=list({int(x) for x in user_ids if x}),
            deleted_at__isnull=True,
            is_active=True,
        ).values_list("id", flat=True)
        # 租户内用户优先；平台账号也可能挂角色
        tenant_users = await User.filter(
            id__in=list(active),
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).values_list("id", flat=True)
        pool = [int(x) for x in tenant_users] or [int(x) for x in active]
        return sorted(set(pool))

    async def _filter_active_user_ids(
        self, tenant_id: int, user_ids: list[int]
    ) -> list[int]:
        from infra.models.user import User

        ids = sorted({int(x) for x in user_ids if int(x) > 0})
        if not ids:
            return []
        active = await User.filter(
            id__in=ids,
            deleted_at__isnull=True,
            is_active=True,
        ).values_list("id", flat=True)
        tenant_users = await User.filter(
            id__in=list(active),
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).values_list("id", flat=True)
        pool = [int(x) for x in tenant_users] or [int(x) for x in active]
        return sorted(set(pool))

    async def _list_active_user_ids_by_department(
        self, tenant_id: int, department_id: int
    ) -> list[int]:
        from infra.models.user import User

        if department_id <= 0:
            return []
        user_ids = await User.filter(
            tenant_id=tenant_id,
            department_id=department_id,
            deleted_at__isnull=True,
            is_active=True,
        ).values_list("id", flat=True)
        return sorted({int(x) for x in user_ids if x})

    async def _list_active_user_ids_by_work_group(
        self, tenant_id: int, work_group_id: int
    ) -> list[int]:
        from apps.master_data.models.factory import WorkGroup, WorkGroupMember

        if work_group_id <= 0:
            return []
        group = await WorkGroup.get_or_none(
            id=work_group_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        )
        if not group:
            return []
        member_ids = await WorkGroupMember.filter(
            tenant_id=tenant_id,
            work_group_id=work_group_id,
            deleted_at__isnull=True,
        ).values_list("employee_id", flat=True)
        return await self._filter_active_user_ids(
            tenant_id, [int(x) for x in member_ids if x]
        )

    async def _list_active_user_ids_from_operation_defaults(
        self, tenant_id: int
    ) -> list[int]:
        from apps.master_data.models.process import Operation

        ops = await Operation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        collected: list[int] = []
        for op in ops:
            raw = getattr(op, "default_operator_ids", None) or []
            if not isinstance(raw, list):
                continue
            for x in raw:
                try:
                    uid = int(x)
                except (TypeError, ValueError):
                    continue
                if uid > 0:
                    collected.append(uid)
        return await self._filter_active_user_ids(tenant_id, collected)

    @staticmethod
    def _parse_worker_id_list(raw: Any, fallback: Optional[int] = None) -> list[int]:
        out: list[int] = []
        if isinstance(raw, list):
            for x in raw:
                try:
                    uid = int(x)
                except (TypeError, ValueError):
                    continue
                if uid > 0 and uid not in out:
                    out.append(uid)
        if not out and fallback is not None:
            try:
                uid = int(fallback)
            except (TypeError, ValueError):
                uid = 0
            if uid > 0:
                out.append(uid)
        return out

    async def _workers_for_work_order_operation(
        self,
        *,
        tenant_id: int,
        wo_op: Any,
        fallback_user_id: int,
    ) -> list[int]:
        """工单工序派工人员 → 工序档案默认人员 → 当前用户。"""
        from apps.master_data.models.process import Operation

        assigned = self._parse_worker_id_list(
            getattr(wo_op, "assigned_worker_ids", None),
            getattr(wo_op, "assigned_worker_id", None),
        )
        if assigned:
            active = await self._filter_active_user_ids(tenant_id, assigned)
            if active:
                return active

        op_master_id = int(getattr(wo_op, "operation_id", 0) or 0)
        if op_master_id > 0:
            master = await Operation.get_or_none(
                id=op_master_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if master:
                defaults = self._parse_worker_id_list(
                    getattr(master, "default_operator_ids", None)
                )
                if defaults:
                    active = await self._filter_active_user_ids(tenant_id, defaults)
                    if active:
                        return active

        team_id = int(getattr(wo_op, "assigned_team_id", 0) or 0)
        if team_id > 0:
            team_pool = await self._list_active_user_ids_by_work_group(tenant_id, team_id)
            if team_pool:
                return team_pool

        return [int(fallback_user_id)]

    async def _resolve_operator_pool_for_step(
        self,
        *,
        tenant_id: int,
        step_key: str,
        cfg: StepOperatorConfig,
        fallback_user_id: int,
    ) -> list[int]:
        """返回步骤可用操作人池；报工多批次从中轮换。"""
        from infra.models.user import User

        mode = cfg.normalized_mode()
        if mode == "current":
            return [int(fallback_user_id)]

        if mode == "fixed":
            uid = int(cfg.user_id or 0)
            if uid <= 0:
                return [int(fallback_user_id)]
            user = await User.get_or_none(
                id=uid, tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
            )
            if not user:
                user = await User.get_or_none(id=uid, deleted_at__isnull=True, is_active=True)
            return [int(user.id)] if user else [int(fallback_user_id)]

        if mode == "random_department":
            candidates = await self._list_active_user_ids_by_department(
                tenant_id, int(cfg.department_id or 0)
            )
            return candidates or [int(fallback_user_id)]

        if mode == "random_team":
            candidates = await self._list_active_user_ids_by_work_group(
                tenant_id, int(cfg.work_group_id or 0)
            )
            return candidates or [int(fallback_user_id)]

        if mode == "operation_assigned":
            # 报工步骤在 _step_reporting 内按工序解析；此处给非报工/预览用默认池
            candidates = await self._list_active_user_ids_from_operation_defaults(tenant_id)
            return candidates or [int(fallback_user_id)]

        role_codes: list[str] = []
        if (cfg.role_code or "").strip():
            role_codes.append((cfg.role_code or "").strip())
        role_codes.extend(STEP_DEFAULT_ROLE_CODES.get(step_key, ()))
        seen: set[str] = set()
        uniq_codes: list[str] = []
        for code in role_codes:
            key = code.upper()
            if key in seen:
                continue
            seen.add(key)
            uniq_codes.append(code)
        candidates = await self._list_active_user_ids_by_role_codes(tenant_id, uniq_codes)
        if not candidates:
            return [int(fallback_user_id)]
        return candidates

    @staticmethod
    def _split_reporting_quantities(total: Decimal, batches: int) -> list[Decimal]:
        """把报工数量拆成多批正数，合计等于 total。"""
        total = Decimal(str(total))
        if total <= 0:
            return [Decimal("1")]
        n = max(1, int(batches))
        if total == total.to_integral_value() and total >= 1:
            int_total = int(total)
            n = min(n, int_total)
            if n <= 1:
                return [Decimal(int_total)]
            cuts = sorted(random.sample(range(1, int_total), n - 1))
            parts: list[Decimal] = []
            prev = 0
            for c in cuts + [int_total]:
                parts.append(Decimal(c - prev))
                prev = c
            return parts
        n = min(n, 20)
        if n <= 1:
            return [total]
        # 小数数量：大致均分，尾差落到最后一笔
        base = (total / Decimal(n)).quantize(Decimal("0.001"))
        parts = [base for _ in range(n - 1)]
        last = total - sum(parts)
        if last <= 0:
            return [total]
        parts.append(last)
        return parts

    def _planned_step_labels(self, enabled: dict[str, bool]) -> list[tuple[str, str]]:
        labels = [
            ("demand_computation", "需求计算"),
            ("demand_computation", "生产工单"),
            ("purchase", "采购订单"),
            ("incoming_inspection", "来料检验/入库"),
            ("inventory_topup", "缺料补库"),
            ("production_picking", "生产领料"),
            ("reporting", "工序报工"),
            ("process_inspection", "过程检验"),
            ("finished_goods_inspection", "成品检验"),
            ("finished_goods_receipt", "成品入库"),
            ("shipment_delivery", "发货/出库"),
        ]
        out: list[tuple[str, str]] = []
        for key, label in labels:
            if enabled.get(key, True):
                out.append((key, label))
        # 未勾选来料检验时，采购步骤预览含直接入库
        if enabled.get("purchase", True) and not enabled.get("incoming_inspection", True):
            out = [
                (k, "采购订单/入库" if k == "purchase" and lab == "采购订单" else lab)
                for k, lab in out
            ]
        return out

    def _preview_warnings(
        self, doc: Any, enabled: dict[str, bool], *, source_type: str = "sales_order"
    ) -> list[str]:
        warnings: list[str] = []
        label = "销售预测" if source_type == "sales_forecast" else "销售订单"
        if getattr(doc, "planning_pushed_to_computation", False):
            warnings.append(f"该{label}已下推需求计算，执行将被拒绝")
        if not enabled.get("demand_computation", True):
            warnings.append("需求计算不可关闭")
        if enabled.get("reporting", True):
            warnings.append(
                "同工序多批报工用步骤间隔；跨工序按流转（须完上道/可跳转）与标准工时推进时刻"
            )
        warnings.append("需组织已开启「自动生成工单」且允许计算直推工单")
        warnings.append("BOM/工艺路线不全会导致工单或报工失败")
        if source_type == "sales_forecast":
            warnings.append("销售预测出库走 MTS 加载销售出库，不经过发货通知")
        return warnings

    async def _load_and_validate_sales_order(self, tenant_id: int, sales_order_id: int):
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService

        if not sales_order_id:
            raise ValidationError("请选择销售订单")
        so = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not so:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        svc = SalesOrderService()
        if not svc._is_audited(getattr(so, "status", None)):
            raise BusinessLogicError("销售订单须已审核后方可生成全流程数据")
        if getattr(so, "planning_pushed_to_computation", False):
            raise BusinessLogicError(
                f"销售订单 {so.order_code} 已下推需求计算，请选择未下推的订单以避免脏数据"
            )
        return so

    async def _load_and_validate_sales_forecast(self, tenant_id: int, sales_forecast_id: int):
        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES, ORDER_PUSHABLE_STATUSES
        from apps.kuaizhizao.models.sales_forecast import SalesForecast

        if not sales_forecast_id:
            raise ValidationError("请选择销售预测")
        forecast = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=sales_forecast_id, deleted_at__isnull=True
        )
        if not forecast:
            raise NotFoundError(f"销售预测不存在: {sales_forecast_id}")
        status = str(getattr(forecast, "status", "") or "")
        if status not in ORDER_PUSHABLE_STATUSES and status not in LEGACY_AUDITED_VALUES:
            raise BusinessLogicError("销售预测须已审核后方可生成全流程数据")
        if getattr(forecast, "planning_pushed_to_computation", False):
            raise BusinessLogicError(
                f"销售预测 {forecast.forecast_code} 已下推需求计算，请选择未下推的预测以避免脏数据"
            )
        return forecast

    async def _resolve_warehouse(
        self, tenant_id: int, warehouse_id: Optional[int]
    ) -> dict[str, Any]:
        from apps.master_data.models.warehouse import Warehouse

        if warehouse_id:
            wh = await Warehouse.get_or_none(
                tenant_id=tenant_id, id=warehouse_id, deleted_at__isnull=True
            )
            if not wh:
                raise NotFoundError(f"仓库不存在: {warehouse_id}")
            return {"id": int(wh.id), "name": wh.name or wh.code or str(wh.id)}

        wh = await Warehouse.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
        ).order_by("id").first()
        if not wh:
            raise BusinessLogicError("组织下无可用仓库，请先维护仓库主数据")
        return {"id": int(wh.id), "name": wh.name or wh.code or str(wh.id)}

    async def _record_step(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        run_id: str,
        step_key: str,
        doc_type: str,
        doc_id: int,
        doc_code: str,
        label: str,
        issued_at: datetime,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        note: Optional[str] = None,
    ) -> None:
        log = await OperationLogService.create_operation_log(
            tenant_id=tenant_id,
            user_id=operator_id,
            operation_type="flow_generate",
            operation_module="kuaizhizao",
            operation_object_type=doc_type,
            operation_object_id=int(doc_id),
            operation_content=f"[{run_id}] {label}: {doc_code}",
            request_method="POST",
            request_path="/management/flow-generate",
        )
        entry = TimelineEntry(
            step_key=step_key,
            doc_type=doc_type,
            doc_id=int(doc_id),
            doc_code=str(doc_code or doc_id),
            issued_at=issued_at,
            label=label,
            operation_log_id=int(log.id) if log else None,
            note=note,
        )
        timeline.append(entry)
        step_results.append(
            {
                "step_key": step_key,
                "status": "ok",
                "doc_type": doc_type,
                "doc_id": entry.doc_id,
                "doc_code": entry.doc_code,
                "label": label,
                "issued_at": issued_at.isoformat(),
                "operation_log_id": entry.operation_log_id,
                "note": note,
            }
        )

    async def _rewrite_timeline(self, tenant_id: int, timeline: list[TimelineEntry]) -> None:
        by_type: dict[str, list[dict[str, Any]]] = {}
        for t in timeline:
            by_type.setdefault(t.doc_type, []).append(
                {"id": t.doc_id, "issued_at": t.issued_at}
            )
        code_by_key: dict[tuple[str, int], str] = {}
        for doc_type, items in by_type.items():
            result = await DocumentTimeRewriteService.rewrite_documents_at_exact_times(
                tenant_id=tenant_id,
                doc_type=doc_type,
                items=items,
                sync_operator=True,
                rewrite_code_date=doc_type != "reporting_record",
                preserve_business_dates=False,
            )
            failed = int(result.get("failed") or 0)
            if failed > 0:
                errs = result.get("errors") or []
                sample = "；".join(str(e) for e in errs[:5])
                raise BusinessLogicError(
                    f"业务时间改写失败（{doc_type} 失败 {failed} 条）：{sample}"
                )
            for row in result.get("codes") or []:
                rid = int(row.get("id") or 0)
                code = str(row.get("code") or "").strip()
                if rid > 0 and code:
                    code_by_key[(doc_type, rid)] = code
        for entry in timeline:
            new_code = code_by_key.get((entry.doc_type, entry.doc_id))
            if new_code:
                entry.doc_code = new_code

    async def _align_operation_logs(self, timeline: list[TimelineEntry]) -> None:
        for t in timeline:
            if not t.operation_log_id:
                continue
            await OperationLog.filter(id=t.operation_log_id).update(created_at=t.issued_at)

    # ── business steps ───────────────────────────────────────

    async def _step_push_and_execute_computation(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        sales_order_id: int,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> tuple[int, Optional[int]]:
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService
        from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
        from apps.kuaizhizao.models.demand_computation import DemandComputation
        from apps.kuaizhizao.models.demand import Demand

        push = await SalesOrderService().push_sales_order_to_computation(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=operator_id,
        )
        computation_id = int(push["computation_id"])
        computation = await DemandComputation.get(id=computation_id)
        demand_id = getattr(computation, "demand_id", None)

        # 执行计算
        await DemandComputationService().execute_computation(
            tenant_id=tenant_id,
            computation_id=computation_id,
            operator_id=operator_id,
        )

        issued = planner.next("demand_computation")
        if demand_id:
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
            if demand:
                await self._record_step(
                    tenant_id=tenant_id,
                    operator_id=operator_id,
                    run_id=run_id,
                    step_key="demand_computation",
                    doc_type="demand",
                    doc_id=int(demand.id),
                    doc_code=str(demand.demand_code),
                    label="需求计划",
                    issued_at=issued,
                    timeline=timeline,
                    step_results=step_results,
                )
                issued = planner.next("demand_computation")

        await self._record_step(
            tenant_id=tenant_id,
            operator_id=operator_id,
            run_id=run_id,
            step_key="demand_computation",
            doc_type="demand_computation",
            doc_id=computation_id,
            doc_code=str(push.get("computation_code") or computation.computation_code),
            label="需求计算",
            issued_at=issued,
            timeline=timeline,
            step_results=step_results,
        )
        return computation_id, int(demand_id) if demand_id else None

    async def _step_push_and_execute_computation_from_forecast(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        sales_forecast_id: int,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> tuple[int, Optional[int]]:
        from apps.kuaizhizao.services.sales_service import SalesForecastService
        from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
        from apps.kuaizhizao.models.demand_computation import DemandComputation
        from apps.kuaizhizao.models.demand import Demand

        push = await SalesForecastService().push_to_computation(
            tenant_id=tenant_id,
            forecast_id=sales_forecast_id,
            user_id=operator_id,
        )
        computation_id = int(push["computation_id"])
        computation = await DemandComputation.get(id=computation_id)
        demand_id = getattr(computation, "demand_id", None)

        await DemandComputationService().execute_computation(
            tenant_id=tenant_id,
            computation_id=computation_id,
            operator_id=operator_id,
        )

        issued = planner.next("demand_computation")
        if demand_id:
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
            if demand:
                await self._record_step(
                    tenant_id=tenant_id,
                    operator_id=operator_id,
                    run_id=run_id,
                    step_key="demand_computation",
                    doc_type="demand",
                    doc_id=int(demand.id),
                    doc_code=str(demand.demand_code),
                    label="需求计划",
                    issued_at=issued,
                    timeline=timeline,
                    step_results=step_results,
                )
                issued = planner.next("demand_computation")

        await self._record_step(
            tenant_id=tenant_id,
            operator_id=operator_id,
            run_id=run_id,
            step_key="demand_computation",
            doc_type="demand_computation",
            doc_id=computation_id,
            doc_code=str(push.get("computation_code") or computation.computation_code),
            label="需求计算",
            issued_at=issued,
            timeline=timeline,
            step_results=step_results,
        )
        return computation_id, int(demand_id) if demand_id else None

    async def _step_push_orders(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        computation_id: int,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
        enable_purchase: bool,
    ) -> dict[str, Any]:
        from apps.kuaizhizao.services.demand_computation_service import DemandComputationService

        result = await DemandComputationService().push_all(
            tenant_id=tenant_id,
            computation_id=computation_id,
            created_by=operator_id,
            production="work_order",
            purchase="purchase_order" if enable_purchase else None,
            include_outsource=True,
            push_mode="confirm",
            fill_missing_supplier="random",
            omit_document_notes=True,
        )
        results = result.get("results") or {}
        push_warnings = [
            str(w)
            for w in (result.get("warnings") or results.get("warnings") or [])
            if w
        ]
        if push_warnings:
            results["push_warnings"] = push_warnings
        for wo in results.get("work_orders") or []:
            wo_id = int(wo.get("id") or 0)
            if wo_id <= 0:
                continue
            issued = planner.next("demand_computation")
            await self._record_step(
                tenant_id=tenant_id,
                operator_id=operator_id,
                run_id=run_id,
                step_key="demand_computation",
                doc_type="work_order",
                doc_id=wo_id,
                doc_code=str(wo.get("code") or wo_id),
                label="生产工单",
                issued_at=issued,
                timeline=timeline,
                step_results=step_results,
            )
        for po in results.get("purchase_orders") or []:
            po_id = int(po.get("id") or 0)
            if po_id <= 0:
                continue
            issued = planner.next("purchase")
            await self._record_step(
                tenant_id=tenant_id,
                operator_id=operator_id,
                run_id=run_id,
                step_key="purchase",
                doc_type="purchase_order",
                doc_id=po_id,
                doc_code=str(po.get("order_code") or po.get("code") or po_id),
                label="采购订单",
                issued_at=issued,
                timeline=timeline,
                step_results=step_results,
            )
        for owo in results.get("outsource_work_orders") or []:
            owo_id = int(owo.get("id") or 0)
            if owo_id <= 0:
                continue
            issued = planner.next("demand_computation")
            await self._record_step(
                tenant_id=tenant_id,
                operator_id=operator_id,
                run_id=run_id,
                step_key="demand_computation",
                doc_type="outsource_work_order",
                doc_id=owo_id,
                doc_code=str(owo.get("code") or owo_id),
                label="委外工单",
                issued_at=issued,
                timeline=timeline,
                step_results=step_results,
                note="本版不自动走委外收发，需人工处理",
            )
        return results

    async def _step_approve_purchase_orders(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        purchase_orders: list[dict[str, Any]],
        step_results: list[dict[str, Any]],
        skipped_errors: list[str],
    ) -> list[dict[str, Any]]:
        """审核采购单；失败跳过该单，返回审核成功（或已审核）的 PO 列表。"""
        from apps.kuaizhizao.services.purchase_service import PurchaseService
        from apps.kuaizhizao.schemas.purchase import PurchaseOrderApprove

        po_svc = PurchaseService()
        approved: list[dict[str, Any]] = []
        for po in purchase_orders:
            po_id = int(po.get("id") or 0)
            if po_id <= 0:
                continue
            po_code = str(po.get("order_code") or po.get("code") or po_id)
            try:
                await po_svc.approve_purchase_order(
                    tenant_id=tenant_id,
                    order_id=po_id,
                    approve_data=PurchaseOrderApprove(approved=True),
                    approved_by=operator_id,
                )
                approved.append(po)
            except Exception as exc:
                if self._is_already_done_error(exc):
                    logger.info("PO {} approve skipped: {}", po_id, exc)
                    approved.append(po)
                    continue
                self._append_skip(
                    step_results=step_results,
                    skipped_errors=skipped_errors,
                    step_key="purchase",
                    label=f"采购订单 {po_code}",
                    message=str(exc).strip() or exc.__class__.__name__,
                )
        return approved

    async def _confirm_purchase_receipt(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        receipt_id: int,
        receipt_code: Optional[str],
        step_key: str,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from apps.kuaizhizao.services.warehouse_service import PurchaseReceiptService

        try:
            await PurchaseReceiptService().confirm_receipt(
                tenant_id=tenant_id,
                receipt_id=receipt_id,
                confirmed_by=operator_id,
            )
        except Exception as exc:
            if self._is_already_done_error(exc):
                logger.info("confirm purchase receipt {}: {}", receipt_id, exc)
            else:
                raise BusinessLogicError(
                    f"采购入库确认失败 #{receipt_id}: {exc}"
                ) from exc
        issued = planner.next(step_key)
        await self._record_step(
            tenant_id=tenant_id,
            operator_id=operator_id,
            run_id=run_id,
            step_key=step_key,
            doc_type="purchase_receipt",
            doc_id=receipt_id,
            doc_code=str(receipt_code or receipt_id),
            label="采购入库",
            issued_at=issued,
            timeline=timeline,
            step_results=step_results,
        )

    async def _pass_quality_inspection(
        self,
        *,
        svc: Any,
        tenant_id: int,
        inspection_id: int,
        operator_id: int,
        quantity: Any,
    ) -> None:
        """检验全合格 + 审核（conduct 可能已 auto_pass）。"""
        qty = Decimal(str(quantity or 0))
        if qty < 0:
            qty = Decimal("0")
        try:
            await svc.conduct_inspection(
                tenant_id=tenant_id,
                inspection_id=inspection_id,
                inspection_data={
                    "qualified_quantity": float(qty),
                    "unqualified_quantity": 0,
                },
                inspected_by=operator_id,
            )
        except Exception as exc:
            if not self._is_already_done_error(exc):
                raise BusinessLogicError(
                    f"检验执行失败 #{inspection_id}: {exc}"
                ) from exc
        try:
            await svc.approve_inspection(
                tenant_id=tenant_id,
                inspection_id=inspection_id,
                approved_by=operator_id,
                is_auto_approve=True,
            )
        except Exception as exc:
            if not self._is_already_done_error(exc):
                raise BusinessLogicError(
                    f"检验审核失败 #{inspection_id}: {exc}"
                ) from exc

    async def _step_purchase_direct_receipt(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        purchase_orders: list[dict[str, Any]],
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
        skipped_errors: Optional[list[str]] = None,
    ) -> None:
        """未勾选来料检验：PO 直接下推采购入库并确认；单 PO 失败跳过。"""
        from apps.kuaizhizao.services.purchase_service import PurchaseService

        errs = skipped_errors if skipped_errors is not None else []
        po_svc = PurchaseService()
        for po in purchase_orders:
            po_id = int(po.get("id") or 0)
            if po_id <= 0:
                continue
            po_code = str(po.get("order_code") or po.get("code") or po_id)
            try:
                pushed = await po_svc.push_to_receipt(
                    tenant_id=tenant_id,
                    order_id=po_id,
                    created_by=operator_id,
                    warehouse_id=warehouse["id"],
                )
                receipt_id = int(pushed.get("id") or pushed.get("receipt_id") or 0) or None
                receipt_code = pushed.get("receipt_code") or pushed.get("code")
                if receipt_id:
                    await self._confirm_purchase_receipt(
                        tenant_id=tenant_id,
                        operator_id=operator_id,
                        receipt_id=receipt_id,
                        receipt_code=str(receipt_code) if receipt_code else None,
                        step_key="purchase",
                        planner=planner,
                        timeline=timeline,
                        step_results=step_results,
                        run_id=run_id,
                    )
            except Exception as exc:
                self._append_skip(
                    step_results=step_results,
                    skipped_errors=errs,
                    step_key="purchase",
                    label=f"采购入库 {po_code}",
                    message=str(exc).strip() or exc.__class__.__name__,
                )

    async def _step_incoming_inspection(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        purchase_orders: list[dict[str, Any]],
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
        skipped_errors: Optional[list[str]] = None,
    ) -> None:
        """来料检验：按物料 IQC 预设从 PO 下推；单 PO 失败跳过。"""
        from apps.kuaizhizao.services.purchase_service import PurchaseService
        from apps.kuaizhizao.services.quality_service import IncomingInspectionService

        errs = skipped_errors if skipped_errors is not None else []
        po_svc = PurchaseService()
        iqc_svc = IncomingInspectionService()

        for po in purchase_orders:
            po_id = int(po.get("id") or 0)
            if po_id <= 0:
                continue
            po_code = str(po.get("order_code") or po.get("code") or po_id)
            try:
                receipt_id: Optional[int] = None
                receipt_code: Optional[str] = None
                try:
                    inspections = await iqc_svc.create_inspection_from_purchase_order(
                        tenant_id=tenant_id,
                        purchase_order_id=po_id,
                        created_by=operator_id,
                        force_simple_when_unset=True,
                    )
                except Exception as exc:
                    logger.info(
                        "IQC from PO {} failed, fallback push_to_receipt: {}", po_id, exc
                    )
                    pushed = await po_svc.push_to_receipt(
                        tenant_id=tenant_id,
                        order_id=po_id,
                        created_by=operator_id,
                        warehouse_id=warehouse["id"],
                    )
                    receipt_id = int(pushed.get("id") or pushed.get("receipt_id") or 0) or None
                    receipt_code = pushed.get("receipt_code") or pushed.get("code")
                else:
                    for insp in inspections or []:
                        insp_id = int(getattr(insp, "id", 0) or 0)
                        if insp_id <= 0:
                            continue
                        issued = planner.next("incoming_inspection")
                        await self._record_step(
                            tenant_id=tenant_id,
                            operator_id=operator_id,
                            run_id=run_id,
                            step_key="incoming_inspection",
                            doc_type="incoming_inspection",
                            doc_id=insp_id,
                            doc_code=str(getattr(insp, "inspection_code", None) or insp_id),
                            label="来料检验",
                            issued_at=issued,
                            timeline=timeline,
                            step_results=step_results,
                        )
                        await self._pass_quality_inspection(
                            svc=iqc_svc,
                            tenant_id=tenant_id,
                            inspection_id=insp_id,
                            operator_id=operator_id,
                            quantity=getattr(insp, "inspection_quantity", 0),
                        )
                        try:
                            pushed = await iqc_svc.push_to_purchase_receipt(
                                tenant_id=tenant_id,
                                inspection_id=insp_id,
                                created_by=operator_id,
                                warehouse_id=warehouse["id"],
                            )
                            receipt_id = int(pushed.get("receipt_id") or 0) or receipt_id
                            receipt_code = pushed.get("receipt_code") or receipt_code
                        except Exception as exc:
                            logger.info("IQC push receipt {}: {}", insp_id, exc)

                if receipt_id:
                    await self._confirm_purchase_receipt(
                        tenant_id=tenant_id,
                        operator_id=operator_id,
                        receipt_id=receipt_id,
                        receipt_code=str(receipt_code) if receipt_code else None,
                        step_key="incoming_inspection",
                        planner=planner,
                        timeline=timeline,
                        step_results=step_results,
                        run_id=run_id,
                    )
            except Exception as exc:
                self._append_skip(
                    step_results=step_results,
                    skipped_errors=errs,
                    step_key="incoming_inspection",
                    label=f"来料检验/入库 {po_code}",
                    message=str(exc).strip() or exc.__class__.__name__,
                )

    async def _step_process_inspection(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        work_order_id: int,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        """过程检验：按工序 IPQC 建单并合格审核；无质检/无方案时强制简易。"""
        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.kuaizhizao.services.quality_service import ProcessInspectionService

        svc = ProcessInspectionService()
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence").all()
        if not ops:
            step_results.append(
                {
                    "step_key": "process_inspection",
                    "status": "skipped",
                    "label": f"过程检验 WO#{work_order_id}",
                    "message": "工单无工序，跳过过程检验",
                }
            )
            return

        created_any = False
        for wo_op in ops:
            master_op_id = int(getattr(wo_op, "operation_id", 0) or 0)
            if master_op_id <= 0:
                continue
            op_name = str(getattr(wo_op, "operation_name", None) or f"工序{master_op_id}")
            try:
                await svc.create_inspection_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    operation_id=master_op_id,
                    created_by=operator_id,
                    force_simple_when_unset=True,
                )
            except Exception as exc:
                logger.info(
                    "IPQC create WO#{} op {}: {}", work_order_id, master_op_id, exc
                )

            rows = await ProcessInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=master_op_id,
                deleted_at__isnull=True,
            ).exclude(status="已取消").all()
            for row in rows:
                status = str(getattr(row, "status", "") or "").strip()
                if status == "已审核":
                    continue
                insp_id = int(row.id)
                created_any = True
                issued = planner.next("process_inspection")
                await self._record_step(
                    tenant_id=tenant_id,
                    operator_id=operator_id,
                    run_id=run_id,
                    step_key="process_inspection",
                    doc_type="process_inspection",
                    doc_id=insp_id,
                    doc_code=str(getattr(row, "inspection_code", None) or insp_id),
                    label=f"过程检验-{op_name}",
                    issued_at=issued,
                    timeline=timeline,
                    step_results=step_results,
                )
                if status in ("待检验", "已驳回"):
                    await self._pass_quality_inspection(
                        svc=svc,
                        tenant_id=tenant_id,
                        inspection_id=insp_id,
                        operator_id=operator_id,
                        quantity=getattr(row, "inspection_quantity", 0),
                    )
                elif status in ("已检验", "待审核"):
                    try:
                        await svc.approve_inspection(
                            tenant_id=tenant_id,
                            inspection_id=insp_id,
                            approved_by=operator_id,
                            is_auto_approve=True,
                        )
                    except Exception as exc:
                        logger.info("approve IPQC {}: {}", insp_id, exc)

        if not created_any:
            step_results.append(
                {
                    "step_key": "process_inspection",
                    "status": "skipped",
                    "label": f"过程检验 WO#{work_order_id}",
                    "message": "无可处理过程检验单",
                }
            )

    async def _step_inventory_topup(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        work_order_id: int,
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.services.warehouse_service import OtherInboundService
        from apps.kuaizhizao.schemas.warehouse import OtherInboundCreate, OtherInboundItemCreate
        from apps.kuaizhizao.utils.issue_method_resolver import is_pick_list_material

        try:
            kitting = await WorkOrderService().get_work_order_kitting_analysis(
                tenant_id, work_order_id
            )
        except Exception as exc:
            logger.info("kitting analysis skip: {}", exc)
            return

        shortage_items: list[OtherInboundItemCreate] = []
        for item in getattr(kitting, "items", None) or []:
            if not is_pick_list_material(
                getattr(item, "issue_method", None),
                getattr(item, "source_type", None),
            ):
                continue
            need = Decimal(str(getattr(item, "shortage_quantity", 0) or 0))
            if need <= 0:
                # 兜底：需求 − 已领 − 主仓 − 线边
                required = Decimal(str(getattr(item, "required_quantity", 0) or 0))
                picked = Decimal(str(getattr(item, "picked_quantity", 0) or 0))
                main_avail = Decimal(str(getattr(item, "main_warehouse_available", 0) or 0))
                line_avail = Decimal(str(getattr(item, "line_side_available", 0) or 0))
                need = required - picked - main_avail - line_avail
            if need <= 0:
                continue
            mid = int(getattr(item, "material_id", 0) or 0)
            if mid <= 0:
                continue
            shortage_items.append(
                OtherInboundItemCreate(
                    material_id=mid,
                    material_code=str(getattr(item, "material_code", "") or "") or None,
                    material_name=str(getattr(item, "material_name", "") or "") or None,
                    material_unit=str(getattr(item, "material_unit", "") or "个") or "个",
                    inbound_quantity=float(need),
                )
            )
        if not shortage_items:
            return

        inbound = await OtherInboundService().create_other_inbound(
            tenant_id=tenant_id,
            inbound_data=OtherInboundCreate(
                reason_type="其他",
                warehouse_id=warehouse["id"],
                warehouse_name=warehouse["name"],
                items=shortage_items,
            ),
            created_by=operator_id,
        )
        inbound_id = int(inbound.id)
        try:
            await OtherInboundService().confirm_inbound(
                tenant_id=tenant_id,
                inbound_id=inbound_id,
                confirmed_by=operator_id,
            )
        except Exception as exc:
            logger.info("confirm other inbound {}: {}", inbound_id, exc)

        issued = planner.next("inventory_topup")
        await self._record_step(
            tenant_id=tenant_id,
            operator_id=operator_id,
            run_id=run_id,
            step_key="inventory_topup",
            doc_type="other_inbound",
            doc_id=inbound_id,
            doc_code=str(getattr(inbound, "inbound_code", None) or inbound_id),
            label="其他入库(补库)",
            issued_at=issued,
            timeline=timeline,
            step_results=step_results,
        )

    async def _step_picking(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        work_order_id: int,
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from apps.kuaizhizao.services.warehouse_service import ProductionPickingService

        svc = ProductionPickingService()
        picking = await svc.quick_pick_from_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            created_by=operator_id,
            warehouse_id=warehouse["id"],
            warehouse_name=warehouse["name"],
        )
        picking_id = int(picking.id)
        try:
            await svc.confirm_picking(
                tenant_id=tenant_id,
                picking_id=picking_id,
                confirmed_by=operator_id,
            )
        except Exception as exc:
            logger.info("confirm picking {}: {}", picking_id, exc)

        issued = planner.next("production_picking")
        await self._record_step(
            tenant_id=tenant_id,
            operator_id=operator_id,
            run_id=run_id,
            step_key="production_picking",
            doc_type="production_picking",
            doc_id=picking_id,
            doc_code=str(getattr(picking, "picking_code", None) or picking_id),
            label="生产领料",
            issued_at=issued,
            timeline=timeline,
            step_results=step_results,
        )

    async def _step_reporting(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        operator_pool: Optional[list[int]] = None,
        operator_cfg: Optional[StepOperatorConfig] = None,
        batch_cfg: Optional[ReportingBatchConfig] = None,
        work_order_id: int,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.kuaizhizao.services.reporting_service import ReportingService
        from apps.kuaizhizao.schemas.reporting_record import ReportingRecordCreate
        from infra.models.user import User

        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not wo:
            return
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence").all()
        if not ops:
            step_results.append(
                {
                    "step_key": "reporting",
                    "status": "skipped",
                    "label": f"报工 WO#{work_order_id}",
                    "message": "工单无工序，跳过报工",
                }
            )
            return

        pool = [int(x) for x in (operator_pool or []) if int(x) > 0]
        if not pool:
            pool = [int(operator_id)]
        use_op_assigned = (operator_cfg or StepOperatorConfig()).normalized_mode() == (
            "operation_assigned"
        )
        cfg = (batch_cfg or ReportingBatchConfig()).clamp()
        qty = Decimal(str(wo.quantity or 1))
        if qty <= 0:
            qty = Decimal("1")

        user_cache: dict[int, str] = {}

        async def _worker_name(uid: int) -> str:
            if uid in user_cache:
                return user_cache[uid]
            user = await User.get_or_none(id=uid)
            name = str(uid)
            if user:
                name = (
                    getattr(user, "display_name", None)
                    or getattr(user, "username", None)
                    or str(uid)
                )
            user_cache[uid] = str(name)
            return user_cache[uid]

        svc = ReportingService()
        reporting_interval = planner.interval_for("reporting")
        prev_op_meta: Optional[dict[str, Any]] = None
        for op in ops:
            op_id = int(getattr(op, "operation_id", 0) or op.id)
            op_name = str(getattr(op, "operation_name", None) or f"工序{op_id}")
            op_meta = {
                "allow_jump": bool(getattr(op, "allow_jump", False)),
                "standard_time": getattr(op, "standard_time", None),
                "setup_time": getattr(op, "setup_time", None),
                "name": op_name,
                "code": getattr(op, "operation_code", None),
                "sequence": getattr(op, "sequence", None),
            }
            # 工序间：按流转模式推进业务时刻（须完上道用标准工时，可跳转用短间隔）
            if prev_op_meta is not None:
                gap = self._operation_flow_gap_seconds(
                    prev_op=prev_op_meta,
                    next_op=op_meta,
                    quantity=qty,
                    reporting_cfg=reporting_interval,
                )
                planner.advance_by_seconds(gap)

            batch_count = cfg.pick_batch_count(qty)
            parts = self._split_reporting_quantities(qty, batch_count)
            if use_op_assigned:
                rotating = await self._workers_for_work_order_operation(
                    tenant_id=tenant_id,
                    wo_op=op,
                    fallback_user_id=operator_id,
                )
            else:
                rotating = list(pool)
            if not rotating:
                rotating = [int(operator_id)]
            # 打乱操作人顺序，尽量多角色轮换
            random.shuffle(rotating)
            for batch_idx, part_qty in enumerate(parts, start=1):
                worker_id = rotating[(batch_idx - 1) % len(rotating)]
                worker_name = await _worker_name(worker_id)
                # 同工序多批次：用报工步骤间隔；跨工序首批已由流转 advance 推进游标
                if batch_idx == 1 and prev_op_meta is not None:
                    issued = planner.current()
                else:
                    issued = planner.next("reporting")
                create_data = ReportingRecordCreate(
                    work_order_id=work_order_id,
                    work_order_code=str(wo.code),
                    work_order_name=str(wo.name or wo.code),
                    operation_id=op_id,
                    operation_code=str(getattr(op, "operation_code", None) or op_id),
                    operation_name=op_name,
                    worker_id=worker_id,
                    worker_name=worker_name,
                    reported_quantity=part_qty,
                    qualified_quantity=part_qty,
                    unqualified_quantity=Decimal("0"),
                    work_hours=Decimal("1"),
                    reported_at=issued,
                )
                record = await svc.create_reporting_record(
                    tenant_id=tenant_id,
                    reporting_data=create_data,
                    reported_by=worker_id,
                    entry_mode="quick",
                )
                record_id = int(record.id)
                try:
                    await svc.approve_reporting_record(
                        tenant_id=tenant_id,
                        record_id=record_id,
                        approved_by=worker_id,
                        is_auto_approve=True,
                    )
                except Exception as exc:
                    logger.info("approve reporting {}: {}", record_id, exc)

                flow_note = (
                    "可跳转"
                    if op_meta["allow_jump"]
                    else "须完上道"
                )
                await self._record_step(
                    tenant_id=tenant_id,
                    operator_id=worker_id,
                    run_id=run_id,
                    step_key="reporting",
                    doc_type="reporting_record",
                    doc_id=record_id,
                    doc_code=f"RR-{record_id}",
                    label=f"报工-{op_name} 批{batch_idx}/{len(parts)} {worker_name}",
                    issued_at=issued,
                    timeline=timeline,
                    step_results=step_results,
                    note=f"qty={part_qty} worker=#{worker_id} 流转={flow_note}",
                )
            prev_op_meta = op_meta

    async def _step_fqc(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        work_order_id: int,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from apps.kuaizhizao.services.quality_service import FinishedGoodsInspectionService

        svc = FinishedGoodsInspectionService()
        try:
            insp = await svc.create_inspection_from_work_order(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                created_by=operator_id,
                force_simple_when_unset=True,
            )
        except Exception as exc:
            if self._is_already_done_error(exc):
                step_results.append(
                    {
                        "step_key": "finished_goods_inspection",
                        "status": "skipped",
                        "label": f"成品检验 WO#{work_order_id}",
                        "message": str(exc),
                    }
                )
                return
            raise BusinessLogicError(
                f"成品检验失败 WO#{work_order_id}: {exc}"
            ) from exc

        insp_id = int(insp.id)
        issued = planner.next("finished_goods_inspection")
        await self._record_step(
            tenant_id=tenant_id,
            operator_id=operator_id,
            run_id=run_id,
            step_key="finished_goods_inspection",
            doc_type="finished_goods_inspection",
            doc_id=insp_id,
            doc_code=str(getattr(insp, "inspection_code", None) or insp_id),
            label="成品检验",
            issued_at=issued,
            timeline=timeline,
            step_results=step_results,
        )
        await self._pass_quality_inspection(
            svc=svc,
            tenant_id=tenant_id,
            inspection_id=insp_id,
            operator_id=operator_id,
            quantity=getattr(insp, "inspection_quantity", 0),
        )

    async def _step_fg_receipt(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        work_order_id: int,
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

        svc = FinishedGoodsReceiptService()
        receipt = await svc.quick_receipt_from_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            created_by=operator_id,
            warehouse_id=warehouse["id"],
            warehouse_name=warehouse["name"],
        )
        receipt_id = int(receipt.id)
        inbound_kind = str(getattr(receipt, "inbound_doc_kind", None) or "").strip()
        try:
            if inbound_kind == "semi_finished_goods":
                from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                    SemiFinishedGoodsReceiptService,
                )

                await SemiFinishedGoodsReceiptService().confirm_receipt(
                    tenant_id=tenant_id,
                    receipt_id=receipt_id,
                    confirmed_by=operator_id,
                )
            else:
                await svc.confirm_receipt(
                    tenant_id=tenant_id,
                    receipt_id=receipt_id,
                    confirmed_by=operator_id,
                )
        except Exception as exc:
            if not self._is_already_done_error(exc):
                label = "半成品" if inbound_kind == "semi_finished_goods" else "成品"
                raise BusinessLogicError(
                    f"{label}入库确认失败 #{receipt_id}: {exc}"
                ) from exc

        issued = planner.next("finished_goods_receipt")
        doc_type = (
            "semi_finished_goods_receipt"
            if inbound_kind == "semi_finished_goods"
            else "finished_goods_receipt"
        )
        await self._record_step(
            tenant_id=tenant_id,
            operator_id=operator_id,
            run_id=run_id,
            step_key="finished_goods_receipt",
            doc_type=doc_type,
            doc_id=receipt_id,
            doc_code=str(getattr(receipt, "receipt_code", None) or receipt_id),
            label="半成品入库" if inbound_kind == "semi_finished_goods" else "成品入库",
            issued_at=issued,
            timeline=timeline,
            step_results=step_results,
        )

    async def _step_shipment_delivery(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        sales_order_id: int,
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from infra.services.business_config_service import BusinessConfigService
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService
        from apps.kuaizhizao.services.shipment_notice_service import ShipmentNoticeService
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService

        so_svc = SalesOrderService()
        require_notice = await BusinessConfigService().require_shipment_notice_before_delivery(
            tenant_id
        )
        delivery_id: Optional[int] = None
        delivery_code: Optional[str] = None

        if require_notice:
            notice_result = await so_svc.push_sales_order_to_shipment_notice(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                created_by=operator_id,
                warehouse_id=warehouse["id"],
                warehouse_name=warehouse["name"],
            )
            notice_id = int(notice_result.get("notice_id") or 0)
            if notice_id:
                issued = planner.next("shipment_delivery")
                await self._record_step(
                    tenant_id=tenant_id,
                    operator_id=operator_id,
                    run_id=run_id,
                    step_key="shipment_delivery",
                    doc_type="shipment_notice",
                    doc_id=notice_id,
                    doc_code=str(notice_result.get("notice_code") or notice_id),
                    label="发货通知",
                    issued_at=issued,
                    timeline=timeline,
                    step_results=step_results,
                )
                notified = await ShipmentNoticeService().notify_warehouse(
                    tenant_id=tenant_id,
                    notice_id=notice_id,
                    notified_by=operator_id,
                )
                delivery_id = int(
                    getattr(notified, "sales_delivery_id", None)
                    or notice_result.get("sales_delivery_id")
                    or 0
                ) or None
                delivery_code = (
                    getattr(notified, "sales_delivery_code", None)
                    or notice_result.get("sales_delivery_code")
                )
                related = getattr(notified, "related_sales_delivery_ids", None) or []
                if not delivery_id and related:
                    first = related[0] if isinstance(related[0], dict) else {"id": related[0]}
                    delivery_id = int(first.get("id") or 0) or None
                    delivery_code = first.get("code")
        else:
            pushed = await so_svc.push_sales_order_to_delivery(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                created_by=operator_id,
                warehouse_id=warehouse["id"],
                warehouse_name=warehouse["name"],
            )
            delivery_id = int(pushed.get("delivery_id") or 0) or None
            delivery_code = pushed.get("delivery_code")

        if delivery_id:
            try:
                await SalesDeliveryService().confirm_delivery(
                    tenant_id=tenant_id,
                    delivery_id=delivery_id,
                    confirmed_by=operator_id,
                )
            except Exception as exc:
                if not self._is_already_done_error(exc):
                    raise BusinessLogicError(
                        f"销售出库确认失败 #{delivery_id}: {exc}"
                    ) from exc
            issued = planner.next("shipment_delivery")
            await self._record_step(
                tenant_id=tenant_id,
                operator_id=operator_id,
                run_id=run_id,
                step_key="shipment_delivery",
                doc_type="sales_delivery",
                doc_id=delivery_id,
                doc_code=str(delivery_code or delivery_id),
                label="销售出库",
                issued_at=issued,
                timeline=timeline,
                step_results=step_results,
            )
        else:
            raise BusinessLogicError("未能生成销售出库单，请检查订单可出库量与仓库配置")

    async def _step_shipment_delivery_from_forecast(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        sales_forecast_id: int,
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService

        delivery = await SalesDeliveryService().pull_from_sales_forecast(
            tenant_id=tenant_id,
            sales_forecast_id=sales_forecast_id,
            created_by=operator_id,
            warehouse_id=warehouse["id"],
            warehouse_name=warehouse["name"],
        )
        delivery_id = int(getattr(delivery, "id", None) or 0)
        delivery_code = getattr(delivery, "delivery_code", None)
        if delivery_id:
            try:
                await SalesDeliveryService().confirm_delivery(
                    tenant_id=tenant_id,
                    delivery_id=delivery_id,
                    confirmed_by=operator_id,
                )
            except Exception as exc:
                if not self._is_already_done_error(exc):
                    raise BusinessLogicError(
                        f"销售出库确认失败 #{delivery_id}: {exc}"
                    ) from exc
            issued = planner.next("shipment_delivery")
            await self._record_step(
                tenant_id=tenant_id,
                operator_id=operator_id,
                run_id=run_id,
                step_key="shipment_delivery",
                doc_type="sales_delivery",
                doc_id=delivery_id,
                doc_code=str(delivery_code or delivery_id),
                label="销售出库(预测)",
                issued_at=issued,
                timeline=timeline,
                step_results=step_results,
            )
        else:
            raise BusinessLogicError(
                "未能从销售预测生成销售出库单，请检查预测可出库量与仓库配置"
            )


def parse_intervals(raw: Optional[dict[str, Any]]) -> dict[str, IntervalConfig]:
    out: dict[str, IntervalConfig] = {}
    if not raw:
        return out
    for key, val in raw.items():
        if not isinstance(val, dict):
            continue
        out[str(key)] = IntervalConfig(
            min_seconds=int(val.get("min_seconds", DEFAULT_INTERVAL_MIN)),
            max_seconds=int(val.get("max_seconds", DEFAULT_INTERVAL_MAX)),
        ).clamp()
    return out


def _optional_positive_int(val: Any) -> Optional[int]:
    if val in (None, "", 0, "0"):
        return None
    try:
        n = int(val)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def parse_step_operators(raw: Optional[dict[str, Any]]) -> dict[str, StepOperatorConfig]:
    out: dict[str, StepOperatorConfig] = {}
    if not raw:
        return out
    for key, val in raw.items():
        step_key = str(key)
        if step_key not in STEP_KEYS:
            continue
        if not isinstance(val, dict):
            continue
        out[step_key] = StepOperatorConfig(
            mode=str(val.get("mode") or "random_role"),
            user_id=_optional_positive_int(val.get("user_id")),
            role_code=(str(val.get("role_code")).strip() if val.get("role_code") else None),
            department_id=_optional_positive_int(val.get("department_id")),
            work_group_id=_optional_positive_int(val.get("work_group_id")),
        )
    return out


def parse_reporting_batches(raw: Optional[dict[str, Any]]) -> ReportingBatchConfig:
    if not raw:
        return ReportingBatchConfig(
            DEFAULT_REPORTING_BATCHES_MIN, DEFAULT_REPORTING_BATCHES_MAX
        ).clamp()
    return ReportingBatchConfig(
        min_batches=int(raw.get("min_batches", DEFAULT_REPORTING_BATCHES_MIN)),
        max_batches=int(raw.get("max_batches", DEFAULT_REPORTING_BATCHES_MAX)),
    ).clamp()


def parse_work_schedule(raw: Optional[dict[str, Any]]) -> Optional[WorkScheduleParams]:
    if not raw:
        return None
    schedule = WorkScheduleParams(
        weekdays=list(raw.get("weekdays") or [0, 1, 2, 3, 4]),
        start_time=str(raw.get("start_time") or "09:00"),
        end_time=str(raw.get("end_time") or "18:00"),
        lookback_days=int(raw.get("lookback_days") or 14),
    )
    schedule.validate()
    return schedule
