"""按销售订单生成制造全流程演示数据（运维造数）。"""

from __future__ import annotations

import asyncio
import random
import re
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

# 操作日志 content：`[run_id][step_key][wo=123] label: code`（wo 段可选）
_FLOW_LOG_CONTENT_RE = re.compile(
    r"^\[(?P<run_id>[^\]]+)\]"
    r"(?:\[(?P<step_key>[^\]]+)\])?"
    r"(?:\[wo=(?P<wo_id>\d+)\])?"
    r"\s*(?P<label>.+?):\s*(?P<doc_code>.*)$"
)


class FlowGenerateFailedError(BusinessLogicError):
    """造数失败且可续跑：携带 run_id 供前端「继续未完成」。"""

    def __init__(self, message: str, *, run_id: str, resumable: bool = True) -> None:
        super().__init__(message)
        self.run_id = str(run_id)
        self.resumable = bool(resumable)


STEP_KEYS = (
    "demand_computation",
    "purchase",
    "incoming_inspection",
    "outsource",
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
    "outsource": ("WAREHOUSE_OPERATOR", "PURCHASE_PERSON"),
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
    work_order_id: Optional[int] = None


@dataclass
class FlowResumeCheckpoint:
    """从操作日志恢复的造数检查点。"""

    run_id: str
    entries: list[TimelineEntry] = field(default_factory=list)
    computation_id: Optional[int] = None
    demand_id: Optional[int] = None
    has_push: bool = False
    has_purchase_inbound: bool = False
    has_shipment: bool = False
    completed_wo_ids: set[int] = field(default_factory=set)
    wo_done_steps: dict[int, set[str]] = field(default_factory=dict)


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
    # 自选需走生产链完工的物料（None/空=全部下推工单）；按下推后 product_id 过滤
    selected_material_ids: Optional[list[int]] = None
    # 多工单生产链并行推进业务时刻（fork 时间线）
    parallel_work_orders: bool = True
    # 数量并行组：每组报工件数范围（如 1–3）；启用后同工序各组按报工间隔错开
    parallel_group_size_min: Optional[int] = None
    parallel_group_size_max: Optional[int] = None
    # 流程结束锚点：与 anchor_at 组成时间窗，用于推算步骤间隔
    flow_end_at: Optional[datetime] = None
    # 来料检建单失败时是否允许直推入库（默认关，禁止静默旁路）
    allow_skip_iqc: bool = False
    # 续跑：沿用失败轮次的 run_id，按操作日志检查点跳过已完成阶段
    resume_run_id: Optional[str] = None

    def parallel_group_range(self) -> Optional[tuple[int, int]]:
        lo = int(self.parallel_group_size_min or 0)
        hi = int(self.parallel_group_size_max or 0)
        if lo <= 0 and hi <= 0:
            return None
        if lo <= 0:
            lo = 1
        if hi <= 0:
            hi = lo
        if hi < lo:
            lo, hi = hi, lo
        return (max(1, lo), max(1, hi))

    def normalized_source(self) -> str:
        raw = (self.source_type or "sales_order").strip().lower()
        if raw in ("sales_forecast", "forecast"):
            return "sales_forecast"
        return "sales_order"

    def selected_material_id_set(self) -> Optional[set[int]]:
        if self.selected_material_ids is None:
            return None
        ids = {int(x) for x in self.selected_material_ids if int(x or 0) > 0}
        return ids


class TimelinePlanner:
    """按间隔随机生成严格递增的业务时刻（禁止整分整秒；可钳工作时段）。"""

    def __init__(
        self,
        *,
        anchor: datetime,
        default_interval: IntervalConfig,
        intervals: dict[str, IntervalConfig],
        work_schedule: Optional[WorkScheduleParams] = None,
        use_work_schedule: bool = False,
        deadline: Optional[datetime] = None,
        remaining_events: Optional[int] = None,
    ) -> None:
        self._default = default_interval.clamp()
        self._intervals = {k: v.clamp() for k, v in intervals.items()}
        self._schedule = work_schedule
        self._use_schedule = bool(use_work_schedule and work_schedule)
        self._tz = ZoneInfo(site_timezone_name())
        self._deadline = (
            resolve_business_datetime(deadline).replace(microsecond=0)
            if deadline is not None
            else None
        )
        self._remaining = (
            max(1, int(remaining_events)) if remaining_events is not None else None
        )
        # 锚点先钳进工作时段，避免从凌晨起算
        self._cursor = self._normalize_to_work(
            resolve_business_datetime(anchor).replace(microsecond=0)
        )

    def interval_for(self, step_key: str) -> IntervalConfig:
        return self._intervals.get(step_key, self._default)

    def current(self) -> datetime:
        return self._cursor

    def set_cursor(self, when: datetime) -> None:
        """设置游标（可回拨，用于多工单/可跳转工序并行时间线）。"""
        self._cursor = self._normalize_to_work(
            resolve_business_datetime(when).replace(microsecond=0)
        )

    def bump_to(self, when: datetime) -> None:
        """游标仅向前对齐到 when（取较晚者）。"""
        when_utc = self._normalize_to_work(
            resolve_business_datetime(when).replace(microsecond=0)
        )
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
            deadline=self._deadline,
            remaining_events=self._remaining,
        )
        other._cursor = self._cursor
        return other

    @staticmethod
    def _avoid_round_clock(when: datetime) -> datetime:
        """禁止整秒（:00）；秒落在 7–53 的不规则区。"""
        when = when.replace(microsecond=0)
        if when.second == 0 or when.second >= 57:
            when = when + timedelta(seconds=random.randint(7, 53))
        return when

    def _normalize_to_work(self, when_utc: datetime) -> datetime:
        """UTC 时刻 → 避整秒；开启工作时段则钳到 09:00–18:00 工作日。"""
        when_utc = self._avoid_round_clock(when_utc)
        if not (self._use_schedule and self._schedule is not None):
            return when_utc
        site = when_utc.astimezone(self._tz)
        site = self._clamp_forward(site)
        return self._avoid_round_clock(
            site.astimezone(timezone.utc).replace(microsecond=0)
        )

    def work_seconds_between(self, start_utc: datetime, end_utc: datetime) -> float:
        """两时刻之间的可用工作秒（仅工作日窗口内）。无工作时段则退回墙钟差。"""
        start_utc = resolve_business_datetime(start_utc)
        end_utc = resolve_business_datetime(end_utc)
        if end_utc <= start_utc:
            return 0.0
        if not (self._use_schedule and self._schedule is not None):
            return max(0.0, (end_utc - start_utc).total_seconds())
        start_site = start_utc.astimezone(self._tz)
        end_site = end_utc.astimezone(self._tz)
        total = 0.0
        day = start_site.date()
        while day <= end_site.date():
            window = self._schedule.window_on(day, self._tz)
            if window is not None:
                a, b = window
                lo = max(a, start_site)
                hi = min(b, end_site)
                if hi > lo:
                    total += (hi - lo).total_seconds()
            day += timedelta(days=1)
        return max(0.0, total)

    def next(self, step_key: str) -> datetime:
        # 时间窗模式：按剩余事件均分「剩余工作秒」，再钳回工作时段
        if self._deadline is not None and self._remaining is not None:
            remain_sec = self.work_seconds_between(self._cursor, self._deadline)
            left = max(1, int(self._remaining))
            base = max(1.0, (remain_sec * 0.92) / left) if remain_sec > 0 else 60.0
            gap = random.uniform(base * 0.78, base * 0.98)
            gap += random.uniform(3.0, 17.0)
            self._remaining = left - 1
            return self.advance_by_seconds(gap)

        cfg = self.interval_for(step_key)
        gap = random.uniform(float(cfg.min_seconds), float(cfg.max_seconds))
        nearest_min = round(gap / 60.0) * 60.0
        if abs(gap - nearest_min) < 8.0:
            gap += random.uniform(11.0, 47.0)
        else:
            gap += random.uniform(3.0, 29.0)
        return self.advance_by_seconds(gap)

    def advance_capped(
        self,
        desired_seconds: float,
        *,
        max_fraction_of_remain: float = 0.28,
    ) -> datetime:
        """推进 desired 秒；有截止窗时不超过剩余工作秒的比例份额（保留标准工时意图）。"""
        gap = max(1.0, float(desired_seconds))
        if self._deadline is not None:
            remain = self.work_seconds_between(self._cursor, self._deadline)
            if remain > 0:
                cap = max(12.0, remain * max(0.05, float(max_fraction_of_remain)))
                gap = min(gap, cap)
            else:
                gap = random.uniform(11.0, 47.0)
        return self.advance_by_seconds(gap)

    def advance_by_seconds(self, seconds: float) -> datetime:
        """按明确秒数推进游标；开启工作时段时过 18:00 滚到下一工作日 09:00。"""
        gap = max(1.0, float(seconds))
        nxt = self._cursor + timedelta(seconds=gap)
        nxt = self._normalize_to_work(nxt)
        if nxt <= self._cursor:
            # 钳制后仍未前进：强制滚到下一工作空隙
            nxt = self._normalize_to_work(
                self._cursor + timedelta(seconds=random.randint(60, 180))
            )
            if nxt <= self._cursor and self._use_schedule and self._schedule is not None:
                site = self._cursor.astimezone(self._tz)
                day = site.date() + timedelta(days=1)
                for _ in range(14):
                    window = self._schedule.window_on(day, self._tz)
                    if window is not None:
                        nxt = self._avoid_round_clock(
                            window[0].astimezone(timezone.utc).replace(microsecond=0)
                        )
                        break
                    day += timedelta(days=1)
        if self._deadline is not None and nxt >= self._deadline:
            # 压回截止前，并再次钳工作时段（禁止凌晨）
            remain_work = self.work_seconds_between(self._cursor, self._deadline)
            step = max(8.0, min(remain_work * 0.5, 120.0)) if remain_work > 0 else 8.0
            nxt = self._normalize_to_work(
                self._cursor + timedelta(seconds=step)
            )
            if nxt >= self._deadline:
                nxt = self._normalize_to_work(
                    self._deadline - timedelta(seconds=random.randint(11, 47))
                )
                if nxt <= self._cursor:
                    nxt = self._cursor
        self._cursor = nxt
        return nxt

    def _clamp_forward(self, when_site: datetime) -> datetime:
        """保证落在工作时段内；过晚/非工作日则推到下一工作日上班时刻。"""
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
                return self._avoid_round_clock(start)
            if cur < start:
                return self._avoid_round_clock(start)
            if cur > last:
                day += timedelta(days=1)
                cur = datetime(day.year, day.month, day.day, tzinfo=self._tz)
                continue
            return self._avoid_round_clock(cur)
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
        op_plan = await self._resolve_source_process_operations(tenant_id, source, doc)
        suggested_intervals: Optional[dict[str, dict[str, int]]] = None
        budget_mode = req.flow_end_at is not None
        flow_deadline: Optional[datetime] = None
        if budget_mode:
            flow_deadline = resolve_business_datetime(req.flow_end_at)
            budgeted = self._suggest_intervals_for_window(
                anchor=anchor,
                end_at=flow_deadline,
                req=req,
                enabled=enabled,
                op_plan=op_plan,
            )
            # 预览用：用户已填步骤间隔优先，缺的用预算补
            merged = {**budgeted, **(req.intervals or {})}
            req.intervals = merged
            sample = next(iter(merged.values()))
            req.default_interval = sample
            suggested_intervals = {
                k: {"min_seconds": v.min_seconds, "max_seconds": v.max_seconds}
                for k, v in budgeted.items()
            }
        tick_count = self._count_timeline_ticks(
            req=req, enabled=enabled, op_plan=op_plan, budget_mode=budget_mode
        )
        planner = TimelinePlanner(
            anchor=anchor,
            default_interval=req.default_interval,
            intervals=req.intervals,
            work_schedule=req.work_schedule,
            use_work_schedule=bool(req.use_work_schedule),
            deadline=flow_deadline,
            remaining_events=tick_count if budget_mode else None,
        )
        preview_times: list[dict[str, Any]] = []
        for key, label in planned_steps:
            if key == "reporting" and op_plan.get("operations"):
                ops_list = op_plan["operations"]
                qty = Decimal(str(op_plan.get("quantity") or 1))
                parts = self._reporting_parts_for_qty(qty, req)
                group_n = len(parts)
                prev_op: Optional[dict[str, Any]] = None
                for idx, op in enumerate(ops_list):
                    if prev_op is not None:
                        gap = self._operation_flow_gap_seconds(
                            prev_op=prev_op,
                            next_op=op,
                            quantity=qty,
                            reporting_cfg=req.intervals.get("reporting")
                            or req.default_interval,
                        )
                        # 时间窗内按标准工时意图推进，超额由 advance_capped 压回剩余工作秒
                        planner.advance_capped(gap)
                    flow_mode = (
                        "可跳转" if bool(op.get("allow_jump")) else "须完上道"
                    )
                    for g_idx, part_qty in enumerate(parts, start=1):
                        if g_idx == 1 and prev_op is not None:
                            issued = planner.current()
                        else:
                            issued = planner.next("reporting")
                        preview_times.append(
                            {
                                "step_key": "reporting",
                                "label": (
                                    f"工序报工-{op.get('name') or op.get('code') or idx + 1}"
                                    f" 组{g_idx}/{group_n}"
                                ),
                                "issued_at": issued.isoformat(),
                                "operation_sequence": int(op.get("sequence") or idx + 1),
                                "operation_code": op.get("code"),
                                "operation_name": op.get("name"),
                                "flow_mode": flow_mode,
                                "note": (
                                    f"流转={flow_mode}"
                                    f"；qty={part_qty}"
                                    f"；标准工时={op.get('standard_time') or '-'}h/件"
                                ),
                            }
                        )
                    prev_op = op
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
            if budget_mode:
                warnings.append(
                    "时间窗模式下跨工序按报工间隔推进（不用标准工时），"
                    "以保证完成时刻不晚于流程结束时间。"
                )
            else:
                warnings.append(
                    "工序报工按工艺流转：须完上道则按上道标准工时推进时刻；"
                    "可跳转工序使用较短间隔。同工序多组按报工间隔错开。"
                )
        elif enabled.get("reporting", True) and not op_plan.get("operations"):
            warnings.append(
                "未解析到源单据物料工艺工序，预览仅显示报工步骤总节点；"
                "执行时将按工单实际工序与流转规则间隔报工。"
            )
        if budget_mode and suggested_intervals:
            warnings.append("已按起止时间推算步骤间隔，可在表单中微调后再次预览。")
        if req.use_work_schedule:
            warnings.append(
                "已钳到工作时段（工作日 09:00–18:00）：过下班滚到下一工作日上班；"
                "时刻不会落在夜间。"
            )
        # 自检：开启工作时段时预览时刻不得落在非工作窗
        # preview_times 的 issued_at 已是 isoformat 字符串，须先解析再 resolve
        if req.use_work_schedule and req.work_schedule and preview_times:
            tz = ZoneInfo(site_timezone_name())
            bad = 0
            for row in preview_times:
                raw = row.get("issued_at")
                if not raw:
                    continue
                if isinstance(raw, str):
                    parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                else:
                    parsed = raw
                when = resolve_business_datetime(parsed).astimezone(tz)
                window = req.work_schedule.window_on(when.date(), tz)
                if window is None or when < window[0] or when >= window[1]:
                    bad += 1
            if bad:
                warnings.append(
                    f"警告：仍有 {bad} 个预览节点落在工作时段外，请反馈以便排查。"
                )
        finish_at = preview_times[-1]["issued_at"] if preview_times else anchor.isoformat()
        return {
            "source_type": source,
            "sales_order_id": doc_id if source == "sales_order" else None,
            "sales_forecast_id": doc_id if source == "sales_forecast" else None,
            "order_code": doc_code,
            "warehouse_id": warehouse["id"],
            "warehouse_name": warehouse["name"],
            "anchor_at": anchor.isoformat(),
            "estimated_finish_at": finish_at,
            "suggested_intervals": suggested_intervals,
            "steps": preview_times,
            "process_operations": op_plan.get("operations") or [],
            "process_material_code": op_plan.get("material_code"),
            "warnings": warnings,
        }

    async def precheck(
        self,
        tenant_id: int,
        req: FlowGenerateRequest,
    ) -> dict[str, Any]:
        """执行前数据预检：仓库/行物料/工艺/BOM/供应商/开关/操作人池；硬拦进 errors。"""
        from apps.master_data.constants.material_source_type import (
            SOURCE_TYPE_BUY,
            SOURCE_TYPE_MAKE,
            SOURCE_TYPE_OUTSOURCE,
        )
        from apps.master_data.models.material import Material
        from apps.master_data.models.supplier import Supplier
        from apps.master_data.services.material_product_process_service import (
            MaterialProductProcessService,
        )
        from apps.master_data.services.material_service import MaterialService
        from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from infra.services.business_config_service import BusinessConfigService

        source = req.normalized_source()
        errors: list[str] = []
        warnings: list[str] = []
        blocking_codes: list[str] = []
        if source == "sales_forecast":
            doc = await self._load_and_validate_sales_forecast(
                tenant_id, int(req.sales_forecast_id or 0)
            )
            doc_id = int(doc.id)
            doc_code = str(doc.forecast_code)
            line_rows = (
                await SalesForecastItem.filter(
                    tenant_id=tenant_id,
                    forecast_id=doc_id,
                    deleted_at__isnull=True,
                )
                .order_by("id")
                .all()
            )
            qty_attr = "forecast_quantity"
        else:
            doc = await self._load_and_validate_sales_order(
                tenant_id, int(req.sales_order_id or 0)
            )
            doc_id = int(doc.id)
            doc_code = str(doc.order_code)
            line_rows = (
                await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id=doc_id,
                    deleted_at__isnull=True,
                )
                .order_by("id")
                .all()
            )
            qty_attr = "order_quantity"

        warehouse = await self._resolve_warehouse(tenant_id, req.warehouse_id)
        enabled = self._enabled_steps(req.steps)
        need_bom = bool(
            enabled.get("production_picking", True) or enabled.get("reporting", True)
        )
        if not line_rows:
            errors.append("源单据无有效行项目")

        material_ids = [
            int(getattr(r, "material_id", 0) or 0)
            for r in line_rows
            if int(getattr(r, "material_id", 0) or 0) > 0
        ]
        materials = await Material.filter(
            tenant_id=tenant_id, id__in=material_ids, deleted_at__isnull=True
        ).all() if material_ids else []
        mat_by_id = {int(m.id): m for m in materials}
        bom_map = (
            await MaterialService.batch_check_has_bom(tenant_id, material_ids)
            if material_ids
            else {}
        )

        candidates: list[dict[str, Any]] = []
        material_id_issues: list[dict[str, Any]] = []
        seen_make: set[int] = set()
        has_buy_lines = False

        def _line_label(row: Any, mid: int) -> str:
            code = str(getattr(row, "material_code", None) or "").strip()
            name = str(getattr(row, "material_name", None) or "").strip()
            parts = [p for p in (code, name) if p]
            base = " ".join(parts) if parts else f"行#{getattr(row, 'id', '?')}"
            return f"{base}（物料ID #{mid}）" if mid > 0 else base

        def _add_block(code: str) -> None:
            if code not in blocking_codes:
                blocking_codes.append(code)

        for row in line_rows:
            mid = int(getattr(row, "material_id", 0) or 0)
            line_id = int(getattr(row, "id", 0) or 0)
            line_code = str(getattr(row, "material_code", None) or "").strip()
            line_name = str(getattr(row, "material_name", None) or "").strip()
            if mid <= 0:
                msg = f"行项目缺少物料 ID：{_line_label(row, 0)}"
                errors.append(msg)
                material_id_issues.append(
                    {
                        "line_id": line_id,
                        "stale_material_id": None,
                        "material_code": line_code or None,
                        "material_name": line_name or None,
                        "issue": "missing_id",
                        "message": msg,
                    }
                )
                continue
            mat = mat_by_id.get(mid)
            if not mat:
                msg = f"物料不存在或不属于当前组织：{_line_label(row, mid)}"
                errors.append(msg)
                material_id_issues.append(
                    {
                        "line_id": line_id,
                        "stale_material_id": mid,
                        "material_code": line_code or None,
                        "material_name": line_name or None,
                        "issue": "stale_id",
                        "message": msg,
                    }
                )
                continue
            code = str(
                getattr(mat, "main_code", None) or getattr(mat, "code", None) or mid
            )
            name = str(getattr(mat, "name", None) or "")
            label = f"{code} {name}".strip()
            st = str(getattr(mat, "source_type", None) or "").strip() or "未知"
            try:
                qty = Decimal(str(getattr(row, qty_attr, None) or 0))
            except Exception:
                qty = Decimal("0")
            has_process = False
            process_ops = 0
            try:
                seq, _ = await MaterialProductProcessService.resolve_sequence_for_material(
                    tenant_id, mid
                )
                ops = self._ops_from_operation_sequence(seq)
                process_ops = len(ops)
                has_process = process_ops > 0
            except Exception as exc:
                warnings.append(f"{label} 工艺解析失败: {exc}")
            has_bom = bool(bom_map.get(mid) or bom_map.get(str(mid)))
            ready = True
            blockers: list[str] = []
            if st == SOURCE_TYPE_MAKE:
                if not has_process and enabled.get("reporting", True):
                    ready = False
                    blockers.append("无工艺工序")
                    errors.append(f"自制件 {label} 未配置工艺工序，报工将失败")
                    _add_block("NO_PROCESS")
                if not has_bom:
                    if need_bom:
                        ready = False
                        blockers.append("无BOM")
                        errors.append(
                            f"自制件 {label} 未配置 BOM，领料/报工造数将失败"
                        )
                        _add_block("NO_BOM")
                    else:
                        warnings.append(
                            f"自制件 {label} 未检出 BOM，需求展开可能失败"
                        )
                if mid not in seen_make:
                    seen_make.add(mid)
                    candidates.append(
                        {
                            "material_id": mid,
                            "material_code": code,
                            "material_name": name,
                            "source_type": st,
                            "quantity": float(qty),
                            "has_process": has_process,
                            "process_operation_count": process_ops,
                            "has_bom": has_bom,
                            "ready": ready,
                            "blockers": blockers,
                        }
                    )
            elif st == SOURCE_TYPE_BUY and enabled.get("purchase", True):
                has_buy_lines = True
                sc = getattr(mat, "source_config", None) or {}
                supplier_id = None
                if isinstance(sc, dict):
                    supplier_id = sc.get("default_supplier_id") or (
                        (sc.get("purchase") or {}).get("default_supplier_id")
                        if isinstance(sc.get("purchase"), dict)
                        else None
                    )
                if not supplier_id:
                    warnings.append(
                        f"采购件 {label} 无默认供应商，下推将随机填入启用供应商"
                    )
            elif st == SOURCE_TYPE_OUTSOURCE:
                warnings.append(f"委外件 {label}：本版造数生成委外工单后不自动收发")

        selected = req.selected_material_id_set()
        if selected is not None:
            unknown = selected - {int(c["material_id"]) for c in candidates}
            if unknown:
                errors.append(f"自选物料不在源单自制件候选中: {sorted(unknown)}")
            not_ready = [
                c
                for c in candidates
                if int(c["material_id"]) in selected and not c.get("ready")
            ]
            for c in not_ready:
                label = f"{c['material_code']} {c.get('material_name') or ''}".strip()
                errors.append(
                    f"自选物料 {label} 未就绪: "
                    f"{'、'.join(c.get('blockers') or ['未就绪'])}"
                )

        # 自动下推工单开关（与 push_all 真门禁对齐）
        if enabled.get("demand_computation", True):
            biz = BusinessConfigService()
            cfg = await biz.get_business_config(tenant_id)
            auto_wo = bool(
                (cfg.get("parameters") or {})
                .get("work_order", {})
                .get("auto_generate", False)
            )
            can_direct = await biz.can_direct_generate_work_order_from_computation(
                tenant_id
            )
            if not auto_wo or not can_direct:
                errors.append(
                    "组织未开启「自动生成工单」或不允许需求计算直推工单，无法造数下推"
                )
                _add_block("AUTO_WO_DISABLED")

        # 采购：组织须有启用供应商池
        if enabled.get("purchase", True) and has_buy_lines:
            supplier_count = await Supplier.filter(
                tenant_id=tenant_id,
                is_active=True,
                deleted_at__isnull=True,
            ).count()
            if supplier_count <= 0:
                errors.append("组织下无启用供应商，无法执行采购造数")
                _add_block("NO_SUPPLIER_POOL")

        # 操作人池：random_* 空池硬拦
        for key in STEP_KEYS:
            if not enabled.get(key, True):
                continue
            cfg = req.step_operators.get(key) or StepOperatorConfig()
            mode = cfg.normalized_mode()
            if mode not in (
                "random_role",
                "random_department",
                "random_team",
            ):
                continue
            pool, reason = await self._probe_random_operator_pool(
                tenant_id=tenant_id, step_key=key, cfg=cfg
            )
            if not pool:
                errors.append(
                    f"步骤 {key} 操作人池为空（{reason or mode}），禁止回退当前用户后执行"
                )
                _add_block("EMPTY_OPERATOR_POOL")

        if enabled.get("incoming_inspection", True):
            warnings.append(
                "来料/过程/成品检按物料质检策略：有方案走真方案；模式为无质检则跳过或直入库（不强制简易）"
            )
            if req.allow_skip_iqc:
                warnings.append("已开启「来料检失败允许直入库」旁路")
            else:
                warnings.append("来料检建单失败将中断整轮（无质检直入库除外；未开启失败旁路）")
        if enabled.get("outsource", True):
            warnings.append("存在委外工单时将自动下达→补库→发料→收货")

        if (
            enabled.get("shipment_delivery", True)
            and source == "sales_order"
        ):
            require_notice = await BusinessConfigService().require_shipment_notice_before_delivery(
                tenant_id
            )
            if require_notice:
                warnings.append(
                    "组织要求先发货通知后出库；造数将按真实门禁走发货通知链"
                )

        ok = len(errors) == 0
        return {
            "ok": ok,
            "source_type": source,
            "sales_order_id": doc_id if source == "sales_order" else None,
            "sales_forecast_id": doc_id if source == "sales_forecast" else None,
            "order_code": doc_code,
            "warehouse_id": warehouse["id"],
            "warehouse_name": warehouse["name"],
            "errors": errors,
            "warnings": warnings,
            "blocking_codes": blocking_codes,
            "work_order_candidates": candidates,
            "material_id_issues": material_id_issues,
            "can_repair_material_ids": len(material_id_issues) > 0,
            "parallel_work_orders_default": True,
        }

    async def _probe_random_operator_pool(
        self,
        *,
        tenant_id: int,
        step_key: str,
        cfg: StepOperatorConfig,
    ) -> tuple[list[int], Optional[str]]:
        """预检用：解析 random_* 池，不回退当前用户。"""
        mode = cfg.normalized_mode()
        if mode == "random_department":
            dept_id = int(cfg.department_id or 0)
            if dept_id <= 0:
                return [], "未选择部门"
            pool = await self._list_active_user_ids_by_department(tenant_id, dept_id)
            return pool, None if pool else f"部门 #{dept_id} 无激活用户"
        if mode == "random_team":
            team_id = int(cfg.work_group_id or 0)
            if team_id <= 0:
                return [], "未选择工作小组"
            pool = await self._list_active_user_ids_by_work_group(tenant_id, team_id)
            return pool, None if pool else f"小组 #{team_id} 无激活成员"
        # random_role
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
        pool = await self._list_active_user_ids_by_role_codes(tenant_id, uniq_codes)
        codes_txt = "/".join(uniq_codes) or "(无角色)"
        return pool, None if pool else f"角色 {codes_txt} 无激活用户"

    async def repair_material_ids(
        self,
        tenant_id: int,
        req: FlowGenerateRequest,
    ) -> dict[str, Any]:
        """按行上物料编码+名称匹配当前主数据，回写失效的 material_id。"""
        from apps.master_data.models.material import Material
        from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

        source = req.normalized_source()
        if source == "sales_forecast":
            doc = await self._load_and_validate_sales_forecast(
                tenant_id, int(req.sales_forecast_id or 0)
            )
            doc_id = int(doc.id)
            doc_code = str(doc.forecast_code)
            line_rows = (
                await SalesForecastItem.filter(
                    tenant_id=tenant_id,
                    forecast_id=doc_id,
                    deleted_at__isnull=True,
                )
                .order_by("id")
                .all()
            )
        else:
            doc = await self._load_and_validate_sales_order(
                tenant_id, int(req.sales_order_id or 0)
            )
            doc_id = int(doc.id)
            doc_code = str(doc.order_code)
            line_rows = (
                await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id=doc_id,
                    deleted_at__isnull=True,
                )
                .order_by("id")
                .all()
            )

        if not line_rows:
            raise BusinessLogicError("源单据无有效行项目，无法修复物料 ID")

        from tortoise.expressions import Q

        line_codes = {
            str(getattr(r, "material_code", None) or "").strip()
            for r in line_rows
            if str(getattr(r, "material_code", None) or "").strip()
        }
        stale_ids = [
            int(getattr(r, "material_id", 0) or 0)
            for r in line_rows
            if int(getattr(r, "material_id", 0) or 0) > 0
        ]
        q = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if line_codes or stale_ids:
            code_q = Q()
            if line_codes:
                code_q |= Q(main_code__in=list(line_codes)) | Q(code__in=list(line_codes))
            if stale_ids:
                code_q |= Q(id__in=stale_ids)
            materials = await Material.filter(q).filter(code_q).all()
        else:
            materials = []

        valid_ids = {int(m.id) for m in materials}
        by_code_name: dict[tuple[str, str], list[Any]] = {}
        by_code: dict[str, list[Any]] = {}
        for m in materials:
            code = str(getattr(m, "main_code", None) or getattr(m, "code", None) or "").strip()
            name = str(getattr(m, "name", None) or "").strip()
            if not code:
                continue
            by_code_name.setdefault((code, name), []).append(m)
            by_code.setdefault(code, []).append(m)

        repaired: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []
        skipped = 0

        for row in line_rows:
            line_id = int(getattr(row, "id", 0) or 0)
            old_mid = int(getattr(row, "material_id", 0) or 0)
            line_code = str(getattr(row, "material_code", None) or "").strip()
            line_name = str(getattr(row, "material_name", None) or "").strip()
            label = f"{line_code} {line_name}".strip() or f"行#{line_id}"

            if old_mid > 0 and old_mid in valid_ids:
                skipped += 1
                continue

            if not line_code:
                failed.append(
                    {
                        "line_id": line_id,
                        "stale_material_id": old_mid or None,
                        "material_code": None,
                        "material_name": line_name or None,
                        "message": f"{label}：行上无物料编码，无法按编码+名称匹配",
                    }
                )
                continue

            matches = list(by_code_name.get((line_code, line_name), []))
            if len(matches) == 0:
                code_only = list(by_code.get(line_code, []))
                if len(code_only) == 1 and not line_name:
                    matches = code_only
                elif len(code_only) == 1:
                    cand = code_only[0]
                    failed.append(
                        {
                            "line_id": line_id,
                            "stale_material_id": old_mid or None,
                            "material_code": line_code,
                            "material_name": line_name or None,
                            "message": (
                                f"{label}：编码匹配到物料 "
                                f"{getattr(cand, 'main_code', None) or getattr(cand, 'code', None)} "
                                f"{getattr(cand, 'name', None)}，但名称不一致，未自动修复"
                            ),
                        }
                    )
                    continue
                else:
                    failed.append(
                        {
                            "line_id": line_id,
                            "stale_material_id": old_mid or None,
                            "material_code": line_code,
                            "material_name": line_name or None,
                            "message": f"{label}：未找到编码+名称均匹配的物料",
                        }
                    )
                    continue
            if len(matches) > 1:
                failed.append(
                    {
                        "line_id": line_id,
                        "stale_material_id": old_mid or None,
                        "material_code": line_code,
                        "material_name": line_name or None,
                        "message": f"{label}：编码+名称匹配到 {len(matches)} 条物料，无法唯一确定",
                    }
                )
                continue

            target = matches[0]
            new_mid = int(target.id)
            new_code = str(
                getattr(target, "main_code", None) or getattr(target, "code", None) or line_code
            )
            new_name = str(getattr(target, "name", None) or line_name)
            row.material_id = new_mid
            row.material_code = new_code
            row.material_name = new_name
            await row.save()
            repaired.append(
                {
                    "line_id": line_id,
                    "stale_material_id": old_mid or None,
                    "material_id": new_mid,
                    "material_code": new_code,
                    "material_name": new_name,
                    "message": f"{label}：#{old_mid or '-'} → #{new_mid}",
                }
            )

        return {
            "success": True,
            "source_type": source,
            "sales_order_id": doc_id if source == "sales_order" else None,
            "sales_forecast_id": doc_id if source == "sales_forecast" else None,
            "order_code": doc_code,
            "repaired_count": len(repaired),
            "failed_count": len(failed),
            "skipped_count": skipped,
            "repaired": repaired,
            "failed": failed,
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
        resume_id = str(req.resume_run_id or "").strip() or None
        run_id = resume_id or str(uuid.uuid4())
        checkpoint: Optional[FlowResumeCheckpoint] = None
        if resume_id:
            checkpoint = await self._load_resume_checkpoint(tenant_id, resume_id)
            await self._emit_progress(progress_cb, 1, f"续跑检查点 {resume_id[:8]}…")

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
        flow_deadline: Optional[datetime] = None
        tick_count: Optional[int] = None
        op_plan_budget: Optional[dict[str, Any]] = None
        if req.flow_end_at is not None:
            flow_deadline = resolve_business_datetime(req.flow_end_at)
            op_plan_budget = await self._resolve_source_process_operations(
                tenant_id, source, sales_order or sales_forecast
            )
            # 未手填步骤间隔：把时间窗均摊进各步骤
            if not req.intervals:
                budgeted = self._suggest_intervals_for_window(
                    anchor=anchor,
                    end_at=flow_deadline,
                    req=req,
                    enabled=enabled,
                    op_plan=op_plan_budget,
                )
                if budgeted:
                    req.intervals = budgeted
                    sample = next(iter(budgeted.values()))
                    req.default_interval = sample
            tick_count = self._count_timeline_ticks(
                req=req,
                enabled=enabled,
                op_plan=op_plan_budget or {},
                budget_mode=True,
            )
        planner = TimelinePlanner(
            anchor=anchor,
            default_interval=req.default_interval,
            intervals=req.intervals,
            work_schedule=req.work_schedule,
            use_work_schedule=bool(req.use_work_schedule),
            deadline=flow_deadline,
            remaining_events=tick_count,
        )

        timeline: list[TimelineEntry] = []
        step_results: list[dict[str, Any]] = []
        outsource_notes: list[str] = []
        demand_id: Optional[int] = None
        completed_wo_count = 0
        skipped_count = 0
        # 需求计算/下推成功后：单项失败不再跳过，整轮失败（已写入保留，可续跑）
        item_phase = False
        if checkpoint:
            outsource_notes.append(f"续跑 run_id={run_id}，已恢复 {len(checkpoint.entries)} 条检查点")
            if checkpoint.entries:
                last_at = max(e.issued_at for e in checkpoint.entries)
                planner.bump_to(last_at)
            # 续跑时检查点单据不再二次改写时间，只改写本轮新增
            timeline_rewrite_from = 0
        else:
            timeline_rewrite_from = 0

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
            computation_id: Optional[int] = None
            work_orders: list[dict[str, Any]] = []
            purchase_orders: list[dict[str, Any]] = []

            # 1) 需求计算
            skip_demand = bool(checkpoint and checkpoint.computation_id)
            if skip_demand:
                computation_id = int(checkpoint.computation_id)  # type: ignore[arg-type]
                demand_id = checkpoint.demand_id
                skipped_count += 1
                outsource_notes.append(f"跳过需求计算（沿用 computation #{computation_id}）")
                await self._emit_progress(progress_cb, 8, "跳过需求计算")
            else:
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

            assert computation_id is not None and computation_id > 0

            # 2) 一键下推工单 + 采购单（续跑优先从需求计算下推关系恢复）
            owos: list[dict[str, Any]] = []
            if checkpoint and checkpoint.computation_id == computation_id:
                (
                    work_orders,
                    purchase_orders,
                    owos,
                ) = await self._load_docs_from_computation_push(
                    tenant_id, computation_id
                )

            if work_orders or purchase_orders or owos:
                skipped_count += 1
                outsource_notes.append(
                    f"跳过下推（已有工单 {len(work_orders)} / 采购 {len(purchase_orders)}）"
                )
                await self._emit_progress(progress_cb, 18, "跳过下推")
            else:
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
                work_orders = await self._enrich_work_orders_product_id(
                    tenant_id, push_results.get("work_orders") or []
                )
                purchase_orders = push_results.get("purchase_orders") or []
                for warn in push_results.get("push_warnings") or []:
                    outsource_notes.append(str(warn))
                owos = push_results.get("outsource_work_orders") or []

            item_phase = True
            timeline_rewrite_from = len(timeline)

            # 2b) 委外：下达 → 补库 → 发料 → 收货
            if enabled.get("outsource", True) and owos:
                pending_owos: list[dict[str, Any]] = []
                for owo in owos:
                    owo_id = int(owo.get("id") or 0)
                    if owo_id <= 0:
                        continue
                    if await self._is_outsource_fulfilled(tenant_id, owo_id):
                        skipped_count += 1
                        continue
                    pending_owos.append(owo)
                if pending_owos:
                    await self._emit_progress(progress_cb, 24, "委外发料收货")
                    await self._step_outsource_fulfillment(
                        tenant_id=tenant_id,
                        operator_id=ops["outsource"],
                        outsource_work_orders=pending_owos,
                        warehouse=warehouse,
                        planner=planner,
                        timeline=timeline,
                        step_results=step_results,
                        run_id=run_id,
                    )
                else:
                    outsource_notes.append(
                        f"跳过委外收发（{len(owos)} 张已收齐）"
                    )

            # 3) 采购：仅处理仍需入库的 PO
            if enabled.get("purchase", True) and purchase_orders:
                pending_pos: list[dict[str, Any]] = []
                for po in purchase_orders:
                    po_id = int(po.get("id") or 0)
                    if po_id <= 0:
                        continue
                    if await self._purchase_order_needs_inbound(tenant_id, po_id):
                        pending_pos.append(po)
                    else:
                        skipped_count += 1
                if not pending_pos:
                    outsource_notes.append("跳过采购入库（订单已全部入库）")
                    await self._emit_progress(progress_cb, 28, "跳过采购入库")
                else:
                    await self._emit_progress(progress_cb, 28, "采购审核与入库")
                    approved_pos = await self._step_approve_purchase_orders(
                        tenant_id=tenant_id,
                        operator_id=ops["purchase"],
                        purchase_orders=pending_pos,
                        step_results=step_results,
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
                                allow_skip_iqc=bool(req.allow_skip_iqc),
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
                            )

            # 4) 生产链：跳过已完成工单
            selected_mids = req.selected_material_id_set()
            complete_wos = self._filter_work_orders_for_complete(work_orders, selected_mids)
            if selected_mids is not None:
                outsource_notes.append(
                    f"工单自选：候选 {len(complete_wos)}/{len(work_orders)} 张"
                    f"（物料 {sorted(selected_mids)}）"
                )
            pending_wos: list[dict[str, Any]] = []
            for wo in complete_wos:
                wo_id = int(wo.get("id") or 0)
                if wo_id <= 0:
                    continue
                if await self._is_work_order_chain_complete(
                    tenant_id, wo_id, enabled, checkpoint
                ):
                    skipped_count += 1
                    continue
                pending_wos.append(wo)
            completed_wo_count = len(complete_wos)
            if pending_wos:
                await self._emit_progress(progress_cb, 35, "生产链完工")
                await self._complete_work_orders_production_chain(
                    tenant_id=tenant_id,
                    ops=ops,
                    reporting_pool=reporting_pool,
                    reporting_cfg=reporting_cfg,
                    batch_cfg=req.reporting_batches.clamp(),
                    parallel_group_range=req.parallel_group_range(),
                    enabled=enabled,
                    work_orders=pending_wos,
                    warehouse=warehouse,
                    planner=planner,
                    timeline=timeline,
                    step_results=step_results,
                    run_id=run_id,
                    parallel=bool(req.parallel_work_orders),
                    progress_cb=progress_cb,
                )
            elif complete_wos:
                outsource_notes.append(
                    f"跳过生产链（{len(complete_wos)} 张工单已完成）"
                )
                await self._emit_progress(progress_cb, 80, "跳过生产链")

            # 5) 发货 / 出库
            if enabled.get("shipment_delivery", True):
                if await self._is_shipment_done(
                    tenant_id=tenant_id,
                    source=source,
                    doc_id=doc_id,
                    checkpoint=checkpoint,
                ):
                    skipped_count += 1
                    outsource_notes.append("跳过发货出库（已出库）")
                    await self._emit_progress(progress_cb, 88, "跳过发货出库")
                else:
                    await self._emit_progress(progress_cb, 88, "发货出库")
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

            await self._emit_progress(progress_cb, 94, "改写业务时间与操作日志")
            new_timeline = timeline[timeline_rewrite_from:]
            if new_timeline:
                await self._rewrite_timeline(tenant_id, new_timeline)
                await self._align_operation_logs(new_timeline)
            await self._emit_progress(progress_cb, 100, "完成")

        except FlowGenerateFailedError:
            raise
        except Exception as exc:
            logger.exception("flow-generate failed: {}", exc)
            detail = str(exc).strip() or exc.__class__.__name__
            if item_phase:
                raise FlowGenerateFailedError(
                    f"流程造数未通过，请修改后可「继续未完成」（run_id={run_id}）：{detail}",
                    run_id=run_id,
                    resumable=True,
                ) from exc
            revert_notes = await self._revert_failed_run(
                tenant_id=tenant_id,
                demand_id=demand_id,
                timeline=timeline,
            )
            if revert_notes:
                detail = f"{detail}；回滚提示：{'；'.join(revert_notes[:5])}"
            raise FlowGenerateFailedError(
                f"流程造数未通过，请修改后重试（本轮写入已撤销）：{detail}",
                run_id=run_id,
                resumable=False,
            ) from exc

        return {
            "success": True,
            "run_id": run_id,
            "resumed": bool(resume_id),
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
                    "work_order_id": t.work_order_id,
                }
                for t in timeline
            ],
            "outsource_notes": outsource_notes,
            "operators": ops,
            "errors": [],
            "skipped_count": skipped_count,
            "completed_work_order_count": completed_wo_count,
        }

    # ── helpers ──────────────────────────────────────────────

    def _enabled_steps(self, steps: dict[str, bool]) -> dict[str, bool]:
        enabled = {k: True for k in STEP_KEYS}
        for k, v in (steps or {}).items():
            if k in enabled:
                enabled[k] = bool(v)
        return enabled

    @staticmethod
    def _fail_flow(label: str, message: str) -> None:
        """业务流转失败：立即中断，不再跳过。"""
        raise BusinessLogicError(f"{label}: {message}")

    @staticmethod
    def _doc_type_to_step_key(doc_type: str) -> str:
        dtype = (doc_type or "").strip()
        mapping = {
            "demand_computation": "demand_computation",
            "work_order": "demand_computation",
            "purchase_order": "demand_computation",
            "outsource_work_order": "demand_computation",
            "outsource_material_issue": "outsource",
            "outsource_material_receipt": "outsource",
            "incoming_inspection": "incoming_inspection",
            "purchase_receipt": "incoming_inspection",
            "other_inbound": "inventory_topup",
            "production_picking": "production_picking",
            "reporting_record": "reporting",
            "process_inspection": "process_inspection",
            "finished_goods_inspection": "finished_goods_inspection",
            "finished_goods_receipt": "finished_goods_receipt",
            "semi_finished_goods_receipt": "finished_goods_receipt",
            "shipment_notice": "shipment_delivery",
            "sales_delivery": "shipment_delivery",
        }
        return mapping.get(dtype, dtype or "unknown")

    @classmethod
    def _parse_flow_log_content(
        cls, content: Optional[str]
    ) -> Optional[dict[str, Any]]:
        text = str(content or "").strip()
        if not text:
            return None
        m = _FLOW_LOG_CONTENT_RE.match(text)
        if not m:
            # 旧格式：`[run_id] label: code`
            legacy = re.match(
                r"^\[(?P<run_id>[^\]]+)\]\s*(?P<label>.+?):\s*(?P<doc_code>.*)$",
                text,
            )
            if not legacy:
                return None
            return {
                "run_id": legacy.group("run_id"),
                "step_key": None,
                "wo_id": None,
                "label": legacy.group("label"),
                "doc_code": legacy.group("doc_code"),
            }
        wo_raw = m.group("wo_id")
        return {
            "run_id": m.group("run_id"),
            "step_key": m.group("step_key"),
            "wo_id": int(wo_raw) if wo_raw else None,
            "label": m.group("label"),
            "doc_code": m.group("doc_code"),
        }

    async def _load_resume_checkpoint(
        self, tenant_id: int, run_id: str
    ) -> FlowResumeCheckpoint:
        rid = str(run_id or "").strip()
        if not rid:
            raise BusinessLogicError("续跑 run_id 不能为空")
        logs = (
            await OperationLog.filter(
                tenant_id=tenant_id,
                operation_type="flow_generate",
                operation_module="kuaizhizao",
                operation_content__startswith=f"[{rid}]",
            )
            .order_by("id")
            .all()
        )
        if not logs:
            raise BusinessLogicError(
                f"未找到 run_id={rid} 的造数检查点，无法续跑"
            )
        cp = FlowResumeCheckpoint(run_id=rid)
        for log in logs:
            parsed = self._parse_flow_log_content(getattr(log, "operation_content", None))
            doc_type = str(getattr(log, "operation_object_type", None) or "").strip()
            doc_id = int(getattr(log, "operation_object_id", 0) or 0)
            step_key = (parsed or {}).get("step_key") or self._doc_type_to_step_key(doc_type)
            wo_id = (parsed or {}).get("wo_id")
            issued = getattr(log, "created_at", None) or resolve_business_datetime()
            entry = TimelineEntry(
                step_key=str(step_key),
                doc_type=doc_type or "unknown",
                doc_id=doc_id,
                doc_code=str((parsed or {}).get("doc_code") or doc_id),
                issued_at=resolve_business_datetime(issued),
                label=str((parsed or {}).get("label") or step_key),
                operation_log_id=int(log.id),
                work_order_id=int(wo_id) if wo_id else None,
            )
            cp.entries.append(entry)
            if doc_type == "demand_computation" and doc_id > 0:
                cp.computation_id = doc_id
            if doc_type in ("work_order", "purchase_order", "outsource_work_order"):
                cp.has_push = True
            if doc_type in ("incoming_inspection", "purchase_receipt"):
                cp.has_purchase_inbound = True
            if doc_type in ("sales_delivery", "shipment_notice"):
                cp.has_shipment = True
            if wo_id and int(wo_id) > 0:
                wid = int(wo_id)
                cp.wo_done_steps.setdefault(wid, set()).add(str(step_key))
                if str(step_key) == "finished_goods_receipt":
                    cp.completed_wo_ids.add(wid)
        if cp.computation_id:
            from apps.kuaizhizao.models.demand_computation import DemandComputation

            comp = await DemandComputation.get_or_none(
                tenant_id=tenant_id, id=cp.computation_id
            )
            if comp:
                cp.demand_id = int(getattr(comp, "demand_id", 0) or 0) or None
        return cp

    async def _load_docs_from_computation_push(
        self, tenant_id: int, computation_id: int
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        from apps.kuaizhizao.services.demand_computation_service import DemandComputationService

        records = (
            await DemandComputationService().get_push_records(tenant_id, computation_id)
        ).get("records") or []
        work_orders: list[dict[str, Any]] = []
        purchase_orders: list[dict[str, Any]] = []
        outsource_work_orders: list[dict[str, Any]] = []
        for row in records:
            if not row.get("target_exists"):
                continue
            tid = int(row.get("target_id") or 0)
            if tid <= 0:
                continue
            tt = str(row.get("target_type") or "").strip()
            code = row.get("target_code")
            if tt == "work_order":
                work_orders.append({"id": tid, "code": code})
            elif tt == "purchase_order":
                purchase_orders.append(
                    {"id": tid, "order_code": code, "code": code}
                )
            elif tt == "outsource_work_order":
                outsource_work_orders.append({"id": tid, "code": code})
        work_orders = await self._enrich_work_orders_product_id(tenant_id, work_orders)
        return work_orders, purchase_orders, outsource_work_orders

    async def _purchase_order_needs_inbound(
        self, tenant_id: int, po_id: int
    ) -> bool:
        """仍有可入余量或存在未确认入库草稿则需要继续采购入库链路。"""
        from apps.kuaizhizao.models.purchase_order import (
            PurchaseOrderItem,
            effective_po_item_outstanding,
        )
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.services.warehouse_service import (
            occupied_purchase_receipt_qty_by_po_item_ids,
            sync_purchase_order_receipt_quantities,
        )

        await sync_purchase_order_receipt_quantities(tenant_id, po_id)
        items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id, order_id=po_id
        ).all()
        if not items:
            return False
        occupied = await occupied_purchase_receipt_qty_by_po_item_ids(
            tenant_id, [po_id]
        )
        for item in items:
            outstanding = float(effective_po_item_outstanding(item))
            occ = float(occupied.get(int(item.id), 0) or 0)
            if outstanding - occ > 1e-9:
                return True
        pending = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id=po_id,
            status__in=["草稿", "draft", "DRAFT", "待入库"],
            deleted_at__isnull=True,
        ).exists()
        return bool(pending)

    async def _is_work_order_chain_complete(
        self,
        tenant_id: int,
        work_order_id: int,
        enabled: dict[str, bool],
        checkpoint: Optional[FlowResumeCheckpoint],
    ) -> bool:
        wo_id = int(work_order_id)
        if checkpoint and wo_id in checkpoint.completed_wo_ids:
            return True
        if checkpoint and wo_id in checkpoint.wo_done_steps:
            done = checkpoint.wo_done_steps[wo_id]
            # 按启用步骤从后往前：已有最后一步记录即视为完成
            for key in (
                "finished_goods_receipt",
                "finished_goods_inspection",
                "process_inspection",
                "reporting",
                "production_picking",
                "inventory_topup",
            ):
                if enabled.get(key, True):
                    if key in done:
                        return True
                    break
        if enabled.get("finished_goods_receipt", True):
            from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt

            posted = await FinishedGoodsReceipt.filter(
                tenant_id=tenant_id,
                work_order_id=wo_id,
                status__in=["已入库", "已完成", "completed"],
                deleted_at__isnull=True,
            ).exists()
            if posted:
                return True
            try:
                from apps.kuaizhizao.models.semi_finished_goods_receipt import (
                    SemiFinishedGoodsReceipt,
                )

                if await SemiFinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    work_order_id=wo_id,
                    status__in=["已入库", "已完成", "completed"],
                    deleted_at__isnull=True,
                ).exists():
                    return True
            except Exception:
                pass
            return False
        if enabled.get("finished_goods_inspection", True):
            from apps.kuaizhizao.models.finished_goods_inspection import (
                FinishedGoodsInspection,
            )

            return await FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                work_order_id=wo_id,
                status__in=["已审核", "已检验"],
                deleted_at__isnull=True,
            ).exists()
        if enabled.get("reporting", True):
            from apps.kuaizhizao.models.work_order import WorkOrder

            wo = await WorkOrder.get_or_none(
                tenant_id=tenant_id, id=wo_id, deleted_at__isnull=True
            )
            st = str(getattr(wo, "status", None) or "")
            return st in ("已完工", "已完成", "completed", "closed")
        return False

    async def _is_shipment_done(
        self,
        *,
        tenant_id: int,
        source: str,
        doc_id: int,
        checkpoint: Optional[FlowResumeCheckpoint],
    ) -> bool:
        if checkpoint and checkpoint.has_shipment:
            return True
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery

        if source == "sales_forecast":
            return await SalesDelivery.filter(
                tenant_id=tenant_id,
                sales_forecast_id=doc_id,
                status__in=["已出库", "已完成", "completed"],
                deleted_at__isnull=True,
            ).exists()
        return await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id=doc_id,
            status__in=["已出库", "已完成", "completed"],
            deleted_at__isnull=True,
        ).exists()

    @staticmethod
    async def _enrich_work_orders_product_id(
        tenant_id: int, work_orders: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        from apps.kuaizhizao.models.work_order import WorkOrder

        ids = [int(w.get("id") or 0) for w in work_orders if int(w.get("id") or 0) > 0]
        if not ids:
            return list(work_orders)
        rows = await WorkOrder.filter(
            tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
        ).all()
        by_id = {int(r.id): r for r in rows}
        out: list[dict[str, Any]] = []
        for wo in work_orders:
            row = dict(wo)
            wid = int(row.get("id") or 0)
            model = by_id.get(wid)
            if model is not None:
                pid = int(getattr(model, "product_id", 0) or 0)
                row["product_id"] = pid
                row["material_id"] = pid
            out.append(row)
        return out

    @staticmethod
    def _filter_work_orders_for_complete(
        work_orders: list[dict[str, Any]],
        selected_material_ids: Optional[set[int]],
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for wo in work_orders:
            if int(wo.get("id") or 0) <= 0:
                continue
            if selected_material_ids is None:
                out.append(wo)
                continue
            mid = int(wo.get("product_id") or wo.get("material_id") or 0)
            if mid in selected_material_ids:
                out.append(wo)
        return out

    async def _complete_one_work_order_chain(
        self,
        *,
        tenant_id: int,
        ops: dict[str, int],
        reporting_pool: list[int],
        reporting_cfg: StepOperatorConfig,
        batch_cfg: ReportingBatchConfig,
        parallel_group_range: Optional[tuple[int, int]],
        enabled: dict[str, bool],
        work_order: dict[str, Any],
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> datetime:
        wo_id = int(work_order.get("id") or 0)
        wo_code = str(work_order.get("code") or wo_id)
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
                    operator_cfg=reporting_cfg,
                    batch_cfg=batch_cfg,
                    parallel_group_range=parallel_group_range,
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
            raise BusinessLogicError(f"工单 {wo_code} 生产链失败: {msg}") from exc
        return planner.current()

    async def _complete_work_orders_production_chain(
        self,
        *,
        tenant_id: int,
        ops: dict[str, int],
        reporting_pool: list[int],
        reporting_cfg: StepOperatorConfig,
        batch_cfg: ReportingBatchConfig,
        parallel_group_range: Optional[tuple[int, int]],
        enabled: dict[str, bool],
        work_orders: list[dict[str, Any]],
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
        parallel: bool,
        progress_cb: Optional[ProgressCallback],
    ) -> None:
        wo_total = max(1, len(work_orders))
        if parallel and len(work_orders) > 1:
            await self._emit_progress(
                progress_cb, 40, f"并行完成 {len(work_orders)} 张工单生产链"
            )
            stagger_cfg = planner.interval_for("reporting")
            stagger_base = random.uniform(
                float(stagger_cfg.min_seconds), float(stagger_cfg.max_seconds)
            )

            async def _one(
                wo: dict[str, Any], wo_index: int
            ) -> tuple[list[TimelineEntry], list[dict[str, Any]], datetime]:
                fork = planner.fork()
                if wo_index > 0:
                    # 多工单资源错开：避免全部从同一 t0 抢同一产能时刻
                    fork.advance_capped(
                        wo_index * stagger_base + random.uniform(90.0, 520.0),
                        max_fraction_of_remain=0.35,
                    )
                local_tl: list[TimelineEntry] = []
                local_sr: list[dict[str, Any]] = []
                end_at = await self._complete_one_work_order_chain(
                    tenant_id=tenant_id,
                    ops=ops,
                    reporting_pool=reporting_pool,
                    reporting_cfg=reporting_cfg,
                    batch_cfg=batch_cfg,
                    parallel_group_range=parallel_group_range,
                    enabled=enabled,
                    work_order=wo,
                    warehouse=warehouse,
                    planner=fork,
                    timeline=local_tl,
                    step_results=local_sr,
                    run_id=run_id,
                )
                return local_tl, local_sr, end_at

            gathered = await asyncio.gather(
                *[_one(wo, i) for i, wo in enumerate(work_orders)],
                return_exceptions=True,
            )
            first_err: Optional[BaseException] = None
            for item in gathered:
                if isinstance(item, BaseException):
                    if first_err is None:
                        first_err = item
                    continue
                local_tl, local_sr, end_at = item
                timeline.extend(local_tl)
                step_results.extend(local_sr)
                planner.bump_to(end_at)
            if first_err is not None:
                raise first_err
            return

        for wo_idx, wo in enumerate(work_orders, start=1):
            wo_code = str(wo.get("code") or wo.get("id") or wo_idx)
            pct = 35 + int(50 * (wo_idx - 1) / wo_total)
            await self._emit_progress(
                progress_cb,
                pct,
                f"生产链 工单 {wo_code}（{wo_idx}/{wo_total}）",
            )
            await self._complete_one_work_order_chain(
                tenant_id=tenant_id,
                ops=ops,
                reporting_pool=reporting_pool,
                reporting_cfg=reporting_cfg,
                batch_cfg=batch_cfg,
                parallel_group_range=parallel_group_range,
                enabled=enabled,
                work_order=wo,
                warehouse=warehouse,
                planner=planner,
                timeline=timeline,
                step_results=step_results,
                run_id=run_id,
            )

    def _is_already_done_error(self, exc: BaseException) -> bool:
        text = str(exc or "")
        markers = ("已审核", "已确认", "已过账", "已入库", "已出库", "已检验", "无需", "不需要")
        return any(m in text for m in markers)

    def _is_no_inspection_needed_error(self, exc: BaseException) -> bool:
        """质检策略为无质检 / 无可检行：应跳过检或直入库，不是失败。"""
        text = str(exc or "")
        markers = (
            "无质检",
            "无需下推",
            "未生成任何来料检验单",
            "质检模式为无质检",
            "未配置成品检验",
            "未配置过程检验",
        )
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
        elif dtype == "outsource_material_issue":
            from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialIssue

            model = OutsourceMaterialIssue
        elif dtype == "outsource_material_receipt":
            from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialReceipt

            model = OutsourceMaterialReceipt
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
        elif dtype == "demand_computation":
            from apps.kuaizhizao.models.demand_computation import DemandComputation

            model = DemandComputation
        elif dtype == "semi_finished_goods_receipt":
            from apps.kuaizhizao.models.semi_finished_goods_receipt import (
                SemiFinishedGoodsReceipt,
            )

            model = SemiFinishedGoodsReceipt
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

    async def revert_run(self, tenant_id: int, run_id: str) -> dict[str, Any]:
        """按 run_id 手动撤回本轮已写入单据（软删 + 撤回需求计算）。"""
        cp = await self._load_resume_checkpoint(tenant_id, str(run_id).strip())
        demand_id: Optional[int] = None
        if cp.computation_id:
            from apps.kuaizhizao.models.demand_computation import DemandComputation

            comp = await DemandComputation.get_or_none(
                tenant_id=tenant_id, id=int(cp.computation_id)
            )
            if comp and int(getattr(comp, "demand_id", 0) or 0) > 0:
                demand_id = int(comp.demand_id)
        notes = await self._revert_failed_run(
            tenant_id=tenant_id,
            demand_id=demand_id,
            timeline=list(cp.entries),
        )
        return {
            "success": True,
            "run_id": cp.run_id,
            "reverted_count": len(cp.entries),
            "demand_id": demand_id,
            "notes": notes,
        }

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
                raise BusinessLogicError(f"{step_key}: 未选择部门，操作人池为空")
            candidates = await self._list_active_user_ids_by_department(tenant_id, dept_id)
            if not candidates:
                raise BusinessLogicError(
                    f"{step_key}: 部门 #{dept_id} 下无激活用户，操作人池为空"
                )
            picked = int(random.choice(candidates))
            return picked, f"{step_key}: 随机选用用户 #{picked}（部门 #{dept_id}）"

        if mode == "random_team":
            team_id = int(cfg.work_group_id or 0)
            if team_id <= 0:
                raise BusinessLogicError(f"{step_key}: 未选择工作小组，操作人池为空")
            candidates = await self._list_active_user_ids_by_work_group(tenant_id, team_id)
            if not candidates:
                raise BusinessLogicError(
                    f"{step_key}: 小组 #{team_id} 下无激活成员，操作人池为空"
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
            raise BusinessLogicError(
                f"{step_key}: 角色 {codes_txt} 下无激活用户，操作人池为空"
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

    @staticmethod
    def _split_qty_into_parallel_groups(
        total: Decimal, size_min: int, size_max: int
    ) -> list[Decimal]:
        """按每组件数范围把总数量拆成并行执行组（合计=total）。

        尾数不足 size_min 时整段落入最后一组，禁止 randint(lo, remain) 在 lo>remain 时空区间。
        """
        total = Decimal(str(total))
        lo = max(1, int(size_min))
        hi = max(lo, int(size_max))
        if total <= 0:
            return [Decimal("1")]
        if total == total.to_integral_value() and total >= 1:
            remain = int(total)
            parts: list[Decimal] = []
            while remain > 0:
                if remain <= lo:
                    take = remain
                else:
                    # remain > lo：上界至少为 lo，且不超过 hi / remain
                    upper = min(hi, remain)
                    take = random.randint(lo, upper)
                parts.append(Decimal(take))
                remain -= take
            return parts or [Decimal(int(total))]
        # 小数：按均分到不超过 hi 的组数
        n = max(1, int((total / Decimal(hi)).to_integral_value()) + 1)
        return FlowDataGenerateService._split_reporting_quantities(total, n)

    def _reporting_parts_for_qty(
        self, qty: Decimal, req: FlowGenerateRequest
    ) -> list[Decimal]:
        group_range = req.parallel_group_range()
        if group_range:
            return self._split_qty_into_parallel_groups(
                qty, group_range[0], group_range[1]
            )
        batch_count = req.reporting_batches.clamp().pick_batch_count(qty)
        return self._split_reporting_quantities(qty, batch_count)

    def _count_timeline_ticks(
        self,
        *,
        req: FlowGenerateRequest,
        enabled: dict[str, bool],
        op_plan: dict[str, Any],
        budget_mode: bool = False,
    ) -> int:
        """估算时间线上会推进的节点数（用于时间窗均摊间隔）。

        budget_mode：跨工序也按报工间隔推进（不再叠标准工时），并计入工序间空档。
        """
        ticks = 0
        for key, _label in self._planned_step_labels(enabled):
            if key == "reporting" and op_plan.get("operations"):
                ops_list = op_plan["operations"]
                qty = Decimal(str(op_plan.get("quantity") or 1))
                parts = self._reporting_parts_for_qty(qty, req)
                n_ops = max(1, len(ops_list))
                n_parts = max(1, len(parts))
                # 每组一次 next；跨工序空档走短 advance，不另占 tick
                ticks += n_ops * n_parts
            else:
                ticks += 1
        return max(1, ticks)

    def _suggest_intervals_for_window(
        self,
        *,
        anchor: datetime,
        end_at: datetime,
        req: FlowGenerateRequest,
        enabled: dict[str, bool],
        op_plan: dict[str, Any],
    ) -> dict[str, IntervalConfig]:
        """按起止时间窗均摊间隔；开启工作时段时按「工作秒」而非墙钟秒。"""
        start = resolve_business_datetime(anchor)
        end = resolve_business_datetime(end_at)
        if end <= start:
            raise BusinessLogicError("流程结束时间必须晚于开始时间（时间锚点）")
        probe = TimelinePlanner(
            anchor=start,
            default_interval=req.default_interval,
            intervals=req.intervals or {},
            work_schedule=req.work_schedule,
            use_work_schedule=bool(req.use_work_schedule),
        )
        span = probe.work_seconds_between(start, end)
        if span <= 0:
            raise BusinessLogicError(
                "起止时间窗内没有可用工作时段（请检查工作日 09:00–18:00 与锚点/结束时间）"
            )
        ticks = self._count_timeline_ticks(
            req=req, enabled=enabled, op_plan=op_plan, budget_mode=True
        )
        base = max(1, int(span / ticks))
        lo = max(1, base - max(1, base // 20))
        hi = max(lo, base)
        cfg = IntervalConfig(min_seconds=lo, max_seconds=hi).clamp()
        return {key: cfg for key, _ in self._planned_step_labels(enabled)}

    def _planned_step_labels(self, enabled: dict[str, bool]) -> list[tuple[str, str]]:
        labels = [
            ("demand_computation", "需求计算"),
            ("demand_computation", "生产工单"),
            ("purchase", "采购订单"),
            ("incoming_inspection", "来料检验/入库"),
            ("outsource", "委外发料/收货"),
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
        work_order_id: Optional[int] = None,
    ) -> None:
        wo_seg = f"[wo={int(work_order_id)}]" if work_order_id and int(work_order_id) > 0 else ""
        content = f"[{run_id}][{step_key}]{wo_seg} {label}: {doc_code}"
        log = await OperationLogService.create_operation_log(
            tenant_id=tenant_id,
            user_id=operator_id,
            operation_type="flow_generate",
            operation_module="kuaizhizao",
            operation_object_type=doc_type,
            operation_object_id=int(doc_id),
            operation_content=content,
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
            work_order_id=int(work_order_id) if work_order_id else None,
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
                "work_order_id": entry.work_order_id,
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

    @staticmethod
    def _po_status_is_confirmed(status: Optional[str]) -> bool:
        from apps.kuaizhizao.constants import (
            DocumentStatus,
            LEGACY_AUDITED_VALUES,
            normalize_status,
        )

        n = normalize_status(str(status or ""))
        return n in (
            DocumentStatus.CONFIRMED.value,
            DocumentStatus.APPROVED.value,
            DocumentStatus.AUDITED.value,
            *LEGACY_AUDITED_VALUES,
        )

    async def _ensure_submitted_then_approve_purchase_order(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        order_id: int,
        order_code: str,
    ) -> None:
        """草稿/驳回先提交；已确认跳过；待审再审核。"""
        from apps.kuaizhizao.constants import (
            is_draft_status,
            is_pending_review_status,
            is_rejected_status,
        )
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder
        from apps.kuaizhizao.schemas.purchase import PurchaseOrderApprove
        from apps.kuaizhizao.services.purchase_service import PurchaseService

        po_svc = PurchaseService()
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise BusinessLogicError(f"采购订单不存在: {order_code}")

        st = str(getattr(order, "status", None) or "").strip()
        if self._po_status_is_confirmed(st):
            return

        if is_draft_status(st) or is_rejected_status(st):
            try:
                submitted = await po_svc.submit_purchase_order(
                    tenant_id=tenant_id,
                    order_id=order_id,
                    submitted_by=operator_id,
                )
            except Exception as exc:
                if self._is_already_done_error(exc):
                    return
                raise BusinessLogicError(
                    f"采购订单 {order_code} 提交审核失败: "
                    f"{str(exc).strip() or exc.__class__.__name__}"
                ) from exc
            st = str(getattr(submitted, "status", None) or "").strip()
            if self._po_status_is_confirmed(st):
                return

        if not is_pending_review_status(st):
            await order.refresh_from_db()
            st = str(getattr(order, "status", None) or "").strip()
            if self._po_status_is_confirmed(st):
                return
            if is_draft_status(st) or is_rejected_status(st):
                submitted = await po_svc.submit_purchase_order(
                    tenant_id=tenant_id,
                    order_id=order_id,
                    submitted_by=operator_id,
                )
                st = str(getattr(submitted, "status", None) or "").strip()
                if self._po_status_is_confirmed(st):
                    return

        try:
            await po_svc.approve_purchase_order(
                tenant_id=tenant_id,
                order_id=order_id,
                approve_data=PurchaseOrderApprove(approved=True),
                approved_by=operator_id,
            )
        except Exception as exc:
            if self._is_already_done_error(exc):
                return
            raise BusinessLogicError(
                f"采购订单 {order_code} 审核失败: "
                f"{str(exc).strip() or exc.__class__.__name__}"
            ) from exc

    async def _ensure_submitted_then_approve_reporting(
        self,
        *,
        svc: Any,
        tenant_id: int,
        record_id: int,
        operator_id: int,
    ) -> None:
        """报工草稿先提交；已通过跳过；pending 再审核。失败抛错不吞。"""
        from apps.kuaizhizao.models.reporting_record import ReportingRecord

        record = await ReportingRecord.get_or_none(id=record_id, tenant_id=tenant_id)
        if not record:
            raise BusinessLogicError(f"报工记录不存在: #{record_id}")
        st = str(getattr(record, "status", None) or "").strip().lower()
        if st in ("approved", "已审核", "已通过"):
            return
        if st in ("draft", "rejected", "草稿", "已驳回"):
            try:
                submitted = await svc.submit_reporting_record(
                    tenant_id=tenant_id,
                    record_id=record_id,
                    submitted_by=operator_id,
                )
            except Exception as exc:
                if self._is_already_done_error(exc):
                    return
                raise BusinessLogicError(
                    f"报工提交审核失败 #{record_id}: "
                    f"{str(exc).strip() or exc.__class__.__name__}"
                ) from exc
            st = str(getattr(submitted, "status", None) or "").strip().lower()
            if st in ("approved", "已审核", "已通过"):
                return
        if st != "pending":
            await record.refresh_from_db()
            st = str(getattr(record, "status", None) or "").strip().lower()
            if st in ("approved", "已审核", "已通过"):
                return
            if st in ("draft", "rejected", "草稿", "已驳回"):
                submitted = await svc.submit_reporting_record(
                    tenant_id=tenant_id,
                    record_id=record_id,
                    submitted_by=operator_id,
                )
                st = str(getattr(submitted, "status", None) or "").strip().lower()
                if st in ("approved", "已审核", "已通过"):
                    return
        try:
            await svc.approve_reporting_record(
                tenant_id=tenant_id,
                record_id=record_id,
                approved_by=operator_id,
                is_auto_approve=True,
            )
        except Exception as exc:
            if self._is_already_done_error(exc):
                return
            raise BusinessLogicError(
                f"报工审核失败 #{record_id}: "
                f"{str(exc).strip() or exc.__class__.__name__}"
            ) from exc

    async def _step_approve_purchase_orders(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        purchase_orders: list[dict[str, Any]],
        step_results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """提交（若仍为草稿）并审核采购单；任一张失败即中断。"""
        approved: list[dict[str, Any]] = []
        for po in purchase_orders:
            po_id = int(po.get("id") or 0)
            if po_id <= 0:
                continue
            po_code = str(po.get("order_code") or po.get("code") or po_id)
            try:
                await self._ensure_submitted_then_approve_purchase_order(
                    tenant_id=tenant_id,
                    operator_id=operator_id,
                    order_id=po_id,
                    order_code=po_code,
                )
                approved.append(po)
            except Exception as exc:
                if self._is_already_done_error(exc):
                    logger.info("PO {} already approved: {}", po_id, exc)
                    approved.append(po)
                    continue
                self._fail_flow(
                    f"采购订单 {po_code}",
                    str(exc).strip() or exc.__class__.__name__,
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

    async def _confirm_purchase_receipts(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        receipts: list[tuple[int, Optional[str]]],
        step_key: str,
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        """逐张确认采购入库（多来料检下推多入库时不得只确认最后一张）。"""
        seen: set[int] = set()
        for receipt_id, receipt_code in receipts:
            rid = int(receipt_id or 0)
            if rid <= 0 or rid in seen:
                continue
            seen.add(rid)
            await self._confirm_purchase_receipt(
                tenant_id=tenant_id,
                operator_id=operator_id,
                receipt_id=rid,
                receipt_code=receipt_code,
                step_key=step_key,
                planner=planner,
                timeline=timeline,
                step_results=step_results,
                run_id=run_id,
            )

    async def _ensure_picking_ready_to_confirm(
        self,
        *,
        svc: Any,
        tenant_id: int,
        picking_id: int,
        operator_id: int,
    ) -> None:
        """开审核时创建落待审：先自动审核到待领料，再允许确认。"""
        from apps.kuaizhizao.models.production_picking import ProductionPicking

        picking = await ProductionPicking.get_or_none(
            tenant_id=tenant_id, id=picking_id, deleted_at__isnull=True
        )
        if not picking:
            raise BusinessLogicError(f"生产领料单不存在: {picking_id}")
        st = str(getattr(picking, "status", None) or "").strip()
        if st in ("已领料", "已完成"):
            return
        if st in ("草稿", "draft", "DRAFT"):
            try:
                await svc.submit_production_picking(
                    tenant_id=tenant_id,
                    picking_id=picking_id,
                    submitted_by=operator_id,
                )
            except Exception as exc:
                if not self._is_already_done_error(exc):
                    raise BusinessLogicError(
                        f"生产领料提交审核失败 #{picking_id}: {exc}"
                    ) from exc
            await picking.refresh_from_db()
            st = str(getattr(picking, "status", None) or "").strip()
        if st == "待审核":
            try:
                await svc.approve_production_picking(
                    tenant_id=tenant_id,
                    picking_id=picking_id,
                    approver_id=operator_id,
                    is_auto_approve=True,
                )
            except Exception as exc:
                if not self._is_already_done_error(exc):
                    raise BusinessLogicError(
                        f"生产领料审核失败 #{picking_id}: {exc}"
                    ) from exc
            await picking.refresh_from_db()
            st = str(getattr(picking, "status", None) or "").strip()
        if st not in ("待领料", "已领料", "已完成"):
            raise BusinessLogicError(
                f"生产领料单 #{picking_id} 无法确认，当前状态: {st or '-'}"
            )

    async def _ensure_sales_delivery_ready_to_confirm(
        self,
        *,
        svc: Any,
        tenant_id: int,
        delivery_id: int,
        operator_id: int,
    ) -> None:
        """草稿/待审先提交再审核，落到待出库后再确认。"""
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery

        delivery = await SalesDelivery.get_or_none(
            tenant_id=tenant_id, id=delivery_id, deleted_at__isnull=True
        )
        if not delivery:
            raise BusinessLogicError(f"销售出库单不存在: {delivery_id}")
        st = str(getattr(delivery, "status", None) or "").strip()
        if st in ("已出库", "已完成", "completed"):
            return
        if st in ("草稿", "draft", "DRAFT"):
            try:
                submitted = await svc.submit_sales_delivery(
                    tenant_id=tenant_id,
                    delivery_id=delivery_id,
                    submitted_by=operator_id,
                )
                st = str(getattr(submitted, "status", None) or "").strip()
            except Exception as exc:
                if not self._is_already_done_error(exc):
                    raise BusinessLogicError(
                        f"销售出库提交审核失败 #{delivery_id}: {exc}"
                    ) from exc
                await delivery.refresh_from_db()
                st = str(getattr(delivery, "status", None) or "").strip()
        if st == "待审核":
            try:
                approved = await svc.approve_sales_delivery(
                    tenant_id=tenant_id,
                    delivery_id=delivery_id,
                    approver_id=operator_id,
                    is_auto_approve=True,
                )
                st = str(getattr(approved, "status", None) or "").strip()
            except Exception as exc:
                if not self._is_already_done_error(exc):
                    raise BusinessLogicError(
                        f"销售出库审核失败 #{delivery_id}: {exc}"
                    ) from exc
                await delivery.refresh_from_db()
                st = str(getattr(delivery, "status", None) or "").strip()
        if st not in ("待出库", "已出库", "已完成", "completed"):
            raise BusinessLogicError(
                f"销售出库单 #{delivery_id} 无法确认，当前状态: {st or '-'}"
            )

    async def _confirm_sales_deliveries(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        deliveries: list[tuple[int, Optional[str]]],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
        label: str = "销售出库",
    ) -> None:
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService

        svc = SalesDeliveryService()
        seen: set[int] = set()
        for delivery_id, delivery_code in deliveries:
            did = int(delivery_id or 0)
            if did <= 0 or did in seen:
                continue
            seen.add(did)
            await self._ensure_sales_delivery_ready_to_confirm(
                svc=svc,
                tenant_id=tenant_id,
                delivery_id=did,
                operator_id=operator_id,
            )
            try:
                await svc.confirm_delivery(
                    tenant_id=tenant_id,
                    delivery_id=did,
                    confirmed_by=operator_id,
                )
            except Exception as exc:
                if not self._is_already_done_error(exc):
                    raise BusinessLogicError(
                        f"销售出库确认失败 #{did}: {exc}"
                    ) from exc
            issued = planner.next("shipment_delivery")
            await self._record_step(
                tenant_id=tenant_id,
                operator_id=operator_id,
                run_id=run_id,
                step_key="shipment_delivery",
                doc_type="sales_delivery",
                doc_id=did,
                doc_code=str(delivery_code or did),
                label=label,
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

    async def _pace_purchase_to_delivery(
        self,
        *,
        tenant_id: int,
        purchase_order_id: int,
        planner: TimelinePlanner,
    ) -> None:
        """将游标推进到采购交期附近工作时刻（到货/检验/入库节奏）。"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder

        po = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=purchase_order_id, deleted_at__isnull=True
        )
        if not po or not getattr(po, "delivery_date", None):
            return
        tz = ZoneInfo(site_timezone_name())
        day = po.delivery_date
        # 交期日上午到货窗口（不规则秒由 normalize 处理）
        site_dt = datetime(
            day.year, day.month, day.day, 10, random.randint(7, 48), random.randint(7, 53),
            tzinfo=tz,
        )
        target = site_dt.astimezone(timezone.utc).replace(microsecond=0)
        planner.bump_to(target)

    async def _is_outsource_fulfilled(self, tenant_id: int, owo_id: int) -> bool:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

        owo = await OutsourceWorkOrder.get_or_none(
            tenant_id=tenant_id, id=owo_id, deleted_at__isnull=True
        )
        if not owo:
            return True
        ordered = Decimal(str(owo.quantity or 0))
        received = Decimal(str(owo.received_quantity or 0))
        if ordered <= 0:
            return True
        return received >= ordered

    async def _step_outsource_fulfillment(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        outsource_work_orders: list[dict[str, Any]],
        warehouse: dict[str, Any],
        planner: TimelinePlanner,
        timeline: list[TimelineEntry],
        step_results: list[dict[str, Any]],
        run_id: str,
    ) -> None:
        """委外闭环：下达 → 缺料补库 → 发料 → 收货。"""
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
        from apps.kuaizhizao.schemas.outsource_work_order import (
            OutsourceMaterialIssueBatchCreate,
            OutsourceMaterialIssueLineCreate,
            OutsourceMaterialReceiptCreate,
        )
        from apps.kuaizhizao.schemas.warehouse import OtherInboundCreate, OtherInboundItemCreate
        from apps.kuaizhizao.services.outsource_material_issue_service import (
            OutsourceMaterialIssueService,
        )
        from apps.kuaizhizao.services.outsource_material_receipt_service import (
            OutsourceMaterialReceiptService,
        )
        from apps.kuaizhizao.services.outsource_work_order_service import (
            OutsourceWorkOrderService,
        )
        from apps.kuaizhizao.services.warehouse_service import OtherInboundService
        from apps.kuaizhizao.utils.outsource_work_order_state import (
            resolve_outsource_work_order_product_unit,
        )

        owo_svc = OutsourceWorkOrderService()
        issue_svc = OutsourceMaterialIssueService()
        receipt_svc = OutsourceMaterialReceiptService()
        inbound_svc = OtherInboundService()

        for row in outsource_work_orders:
            owo_id = int(row.get("id") or 0)
            if owo_id <= 0:
                continue
            owo = await OutsourceWorkOrder.get_or_none(
                tenant_id=tenant_id, id=owo_id, deleted_at__isnull=True
            )
            if not owo:
                continue
            owo_code = str(owo.code or owo_id)
            try:
                if str(owo.status or "").strip() == "draft":
                    await owo_svc.release_outsource_work_order(
                        tenant_id=tenant_id,
                        work_order_id=owo_id,
                        released_by=operator_id,
                    )

                preview = await issue_svc.get_issue_preview(tenant_id, owo_id)
                shortage_items: list[OtherInboundItemCreate] = []
                batch_lines: list[OutsourceMaterialIssueLineCreate] = []
                for line in preview.lines or []:
                    pending = Decimal(str(line.pending_quantity or 0))
                    if pending <= 0:
                        continue
                    available = Decimal(str(line.available_quantity or 0))
                    need = pending - available
                    if need > 0:
                        shortage_items.append(
                            OtherInboundItemCreate(
                                material_id=int(line.material_id),
                                material_code=str(line.material_code or "") or None,
                                material_name=str(line.material_name or "") or None,
                                material_unit=str(line.unit or "个") or "个",
                                inbound_quantity=float(need),
                            )
                        )
                    batch_lines.append(
                        OutsourceMaterialIssueLineCreate(
                            material_id=int(line.material_id),
                            material_code=str(line.material_code or ""),
                            material_name=str(line.material_name or ""),
                            quantity=pending,
                            unit=str(line.unit or "个"),
                            warehouse_id=warehouse["id"],
                            warehouse_name=warehouse["name"],
                        )
                    )

                if shortage_items:
                    inbound = await inbound_svc.create_other_inbound(
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
                        await inbound_svc.confirm_inbound(
                            tenant_id=tenant_id,
                            inbound_id=inbound_id,
                            confirmed_by=operator_id,
                        )
                    except Exception as exc:
                        if not self._is_already_done_error(exc):
                            raise BusinessLogicError(
                                f"委外补库确认失败 #{inbound_id}: {exc}"
                            ) from exc
                    topup_at = planner.next("outsource")
                    await self._record_step(
                        tenant_id=tenant_id,
                        operator_id=operator_id,
                        run_id=run_id,
                        step_key="outsource",
                        doc_type="other_inbound",
                        doc_id=inbound_id,
                        doc_code=str(
                            getattr(inbound, "inbound_code", None) or inbound_id
                        ),
                        label=f"委外补库-{owo_code}",
                        issued_at=topup_at,
                        timeline=timeline,
                        step_results=step_results,
                    )

                if batch_lines:
                    issued_at = planner.next("outsource")
                    batch = await issue_svc.create_material_issues_batch(
                        tenant_id,
                        OutsourceMaterialIssueBatchCreate(
                            outsource_work_order_id=owo_id,
                            outsource_work_order_code=owo_code,
                            warehouse_id=warehouse["id"],
                            warehouse_name=warehouse["name"],
                            issued_at=issued_at,
                            issued_by=operator_id,
                            lines=batch_lines,
                        ),
                        operator_id,
                    )
                    for issue in batch.issues or []:
                        await self._record_step(
                            tenant_id=tenant_id,
                            operator_id=operator_id,
                            run_id=run_id,
                            step_key="outsource",
                            doc_type="outsource_material_issue",
                            doc_id=int(issue.id),
                            doc_code=str(issue.code or issue.id),
                            label=f"委外发料-{owo_code}",
                            issued_at=issued_at,
                            timeline=timeline,
                            step_results=step_results,
                        )

                await owo.refresh_from_db()
                pending_recv = max(
                    Decimal("0"),
                    Decimal(str(owo.quantity or 0))
                    - Decimal(str(owo.received_quantity or 0)),
                )
                if pending_recv <= 0:
                    continue
                if not owo.product_id:
                    raise BusinessLogicError(f"委外工单 {owo_code} 未维护产品，无法收货")

                received_at = planner.next("outsource")
                unit = await resolve_outsource_work_order_product_unit(tenant_id, owo)
                receipt = await receipt_svc.create_material_receipt(
                    tenant_id,
                    OutsourceMaterialReceiptCreate(
                        outsource_work_order_id=owo_id,
                        outsource_work_order_code=owo_code,
                        quantity=pending_recv,
                        qualified_quantity=pending_recv,
                        unqualified_quantity=Decimal("0"),
                        unit=unit,
                        warehouse_id=warehouse["id"],
                        warehouse_name=warehouse["name"],
                        received_at=received_at,
                        received_by=operator_id,
                    ),
                    operator_id,
                )
                await self._record_step(
                    tenant_id=tenant_id,
                    operator_id=operator_id,
                    run_id=run_id,
                    step_key="outsource",
                    doc_type="outsource_material_receipt",
                    doc_id=int(receipt.id),
                    doc_code=str(receipt.code or receipt.id),
                    label=f"委外收货-{owo_code}",
                    issued_at=received_at,
                    timeline=timeline,
                    step_results=step_results,
                )
            except Exception as exc:
                if self._is_already_done_error(exc):
                    logger.info("outsource {} already done: {}", owo_code, exc)
                    continue
                self._fail_flow(
                    f"委外收发 {owo_code}",
                    str(exc).strip() or exc.__class__.__name__,
                )

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
    ) -> None:
        """未勾选来料检验：PO 直接下推采购入库并确认；任一张失败即中断。"""
        from apps.kuaizhizao.services.purchase_service import PurchaseService

        po_svc = PurchaseService()
        for po in purchase_orders:
            po_id = int(po.get("id") or 0)
            if po_id <= 0:
                continue
            po_code = str(po.get("order_code") or po.get("code") or po_id)
            try:
                await self._pace_purchase_to_delivery(
                    tenant_id=tenant_id,
                    purchase_order_id=po_id,
                    planner=planner,
                )
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
                if self._is_already_done_error(exc):
                    logger.info("PO {} direct receipt already done: {}", po_id, exc)
                    continue
                self._fail_flow(
                    f"采购入库 {po_code}",
                    str(exc).strip() or exc.__class__.__name__,
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
        allow_skip_iqc: bool = False,
    ) -> None:
        """来料检验：按物料 IQC 预设从 PO 下推；多检多入库逐张确认；任一张失败即中断。"""
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from apps.kuaizhizao.services.purchase_service import PurchaseService
        from apps.kuaizhizao.services.quality_service import IncomingInspectionService

        po_svc = PurchaseService()
        iqc_svc = IncomingInspectionService()

        for po in purchase_orders:
            po_id = int(po.get("id") or 0)
            if po_id <= 0:
                continue
            po_code = str(po.get("order_code") or po.get("code") or po_id)
            try:
                await self._pace_purchase_to_delivery(
                    tenant_id=tenant_id,
                    purchase_order_id=po_id,
                    planner=planner,
                )
                receipts: list[tuple[int, Optional[str]]] = []
                try:
                    inspections = await iqc_svc.create_inspection_from_purchase_order(
                        tenant_id=tenant_id,
                        purchase_order_id=po_id,
                        created_by=operator_id,
                        force_simple_when_unset=False,
                    )
                except Exception as exc:
                    # 无质检/无可检行 → 直入库；其它失败仅 allow_skip_iqc 才旁路
                    if not (
                        self._is_no_inspection_needed_error(exc) or allow_skip_iqc
                    ):
                        self._fail_flow(
                            f"来料检验 {po_code}",
                            str(exc).strip() or exc.__class__.__name__,
                        )
                    logger.info(
                        "IQC from PO {} skip/direct receipt: {}",
                        po_id,
                        exc,
                    )
                    pushed = await po_svc.push_to_receipt(
                        tenant_id=tenant_id,
                        order_id=po_id,
                        created_by=operator_id,
                        warehouse_id=warehouse["id"],
                    )
                    rid = int(pushed.get("id") or pushed.get("receipt_id") or 0)
                    if rid > 0:
                        receipts.append(
                            (rid, pushed.get("receipt_code") or pushed.get("code"))
                        )
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
                            rid = int(pushed.get("receipt_id") or 0)
                            if rid > 0:
                                receipts.append(
                                    (rid, pushed.get("receipt_code"))
                                )
                        except Exception as exc:
                            if self._is_already_done_error(exc):
                                linked = await IncomingInspection.get_or_none(
                                    tenant_id=tenant_id,
                                    id=insp_id,
                                    deleted_at__isnull=True,
                                )
                                linked_rid = int(
                                    getattr(linked, "purchase_receipt_id", 0) or 0
                                )
                                if linked_rid > 0:
                                    receipts.append(
                                        (
                                            linked_rid,
                                            getattr(
                                                linked, "purchase_receipt_code", None
                                            ),
                                        )
                                    )
                                else:
                                    logger.info(
                                        "IQC push receipt already done #{}, no linked receipt",
                                        insp_id,
                                    )
                            else:
                                raise BusinessLogicError(
                                    f"来料检验下推入库失败 #{insp_id}: {exc}"
                                ) from exc

                if not receipts:
                    raise BusinessLogicError(
                        f"采购订单 {po_code} 未生成可确认的采购入库单"
                    )
                await self._confirm_purchase_receipts(
                    tenant_id=tenant_id,
                    operator_id=operator_id,
                    receipts=receipts,
                    step_key="incoming_inspection",
                    planner=planner,
                    timeline=timeline,
                    step_results=step_results,
                    run_id=run_id,
                )
            except Exception as exc:
                if self._is_already_done_error(exc):
                    logger.info("IQC/receipt PO {} already done: {}", po_id, exc)
                    continue
                self._fail_flow(
                    f"来料检验/入库 {po_code}",
                    str(exc).strip() or exc.__class__.__name__,
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
        """过程检验：按工序 IPQC 建单并合格审核；无质检则跳过该工序。"""
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
            raise BusinessLogicError(f"过程检验失败：工单 WO#{work_order_id} 无工序")

        handled_any = False
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
                    force_simple_when_unset=False,
                )
            except Exception as exc:
                if self._is_no_inspection_needed_error(exc):
                    logger.info(
                        "IPQC skip WO#{} op {} (none): {}",
                        work_order_id,
                        master_op_id,
                        exc,
                    )
                else:
                    logger.info(
                        "IPQC create WO#{} op {}: {}",
                        work_order_id,
                        master_op_id,
                        exc,
                    )

            rows = await ProcessInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=master_op_id,
                deleted_at__isnull=True,
            ).exclude(status="已取消").all()
            for row in rows:
                handled_any = True
                status = str(getattr(row, "status", "") or "").strip()
                if status == "已审核":
                    continue
                insp_id = int(row.id)
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
                    work_order_id=work_order_id,
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
                        if not self._is_already_done_error(exc):
                            raise BusinessLogicError(
                                f"过程检验审核失败 #{insp_id}: {exc}"
                            ) from exc

        if not handled_any:
            # 全部工序质检模式为无质检：跳过过程检，不视为失败
            logger.info(
                "IPQC skip WO#{}: no process inspection required", work_order_id
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
            if self._is_already_done_error(exc):
                logger.info("confirm other inbound {} already done: {}", inbound_id, exc)
            else:
                raise BusinessLogicError(
                    f"其他入库确认失败 #{inbound_id}: "
                    f"{str(exc).strip() or exc.__class__.__name__}"
                ) from exc

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
            work_order_id=work_order_id,
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
        await self._ensure_picking_ready_to_confirm(
            svc=svc,
            tenant_id=tenant_id,
            picking_id=picking_id,
            operator_id=operator_id,
        )
        try:
            await svc.confirm_picking(
                tenant_id=tenant_id,
                picking_id=picking_id,
                confirmed_by=operator_id,
            )
        except Exception as exc:
            if self._is_already_done_error(exc):
                logger.info("confirm picking {} already done: {}", picking_id, exc)
            else:
                raise BusinessLogicError(
                    f"生产领料确认失败 #{picking_id}: "
                    f"{str(exc).strip() or exc.__class__.__name__}"
                ) from exc

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
            work_order_id=work_order_id,
        )

    async def _step_reporting(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        operator_pool: Optional[list[int]] = None,
        operator_cfg: Optional[StepOperatorConfig] = None,
        batch_cfg: Optional[ReportingBatchConfig] = None,
        parallel_group_range: Optional[tuple[int, int]] = None,
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
            raise BusinessLogicError(f"工序报工失败：工单 WO#{work_order_id} 无工序")

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
        # 并行组优先；否则按报工分批
        if parallel_group_range:
            parts = self._split_qty_into_parallel_groups(
                qty, parallel_group_range[0], parallel_group_range[1]
            )
            part_label = "组"
        else:
            parts = self._split_reporting_quantities(qty, cfg.pick_batch_count(qty))
            part_label = "批"

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
            # 工序间：按标准工时流转；有截止窗时 advance_capped 压回剩余工作秒
            if prev_op_meta is not None:
                gap = self._operation_flow_gap_seconds(
                    prev_op=prev_op_meta,
                    next_op=op_meta,
                    quantity=qty,
                    reporting_cfg=reporting_interval,
                )
                planner.advance_capped(gap)

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
            random.shuffle(rotating)
            # 同工序：组1 → 间隔 → 组2 → …（并行组错开）
            for batch_idx, part_qty in enumerate(parts, start=1):
                worker_id = rotating[(batch_idx - 1) % len(rotating)]
                worker_name = await _worker_name(worker_id)
                if batch_idx == 1 and prev_op_meta is not None:
                    issued = planner.current()
                else:
                    issued = planner.next("reporting")
                std_h = float(getattr(op, "standard_time", None) or 0)
                setup_h = (
                    float(getattr(op, "setup_time", None) or 0)
                    if batch_idx == 1
                    else 0.0
                )
                hours_val = setup_h + std_h * float(part_qty)
                if hours_val <= 0:
                    hours_val = max(0.25, float(part_qty) * 0.5)
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
                    work_hours=Decimal(str(round(hours_val, 2))),
                    reported_at=issued,
                )
                record = await svc.create_reporting_record(
                    tenant_id=tenant_id,
                    reporting_data=create_data,
                    reported_by=worker_id,
                    entry_mode="quick",
                )
                record_id = int(record.id)
                await self._ensure_submitted_then_approve_reporting(
                    svc=svc,
                    tenant_id=tenant_id,
                    record_id=record_id,
                    operator_id=worker_id,
                )

                flow_note = "可跳转" if op_meta["allow_jump"] else "须完上道"
                await self._record_step(
                    tenant_id=tenant_id,
                    operator_id=worker_id,
                    run_id=run_id,
                    step_key="reporting",
                    doc_type="reporting_record",
                    doc_id=record_id,
                    doc_code=f"RR-{record_id}",
                    label=(
                        f"报工-{op_name} {part_label}{batch_idx}/{len(parts)} "
                        f"{worker_name}"
                    ),
                    issued_at=issued,
                    timeline=timeline,
                    step_results=step_results,
                    note=f"qty={part_qty} worker=#{worker_id} 流转={flow_note}",
                    work_order_id=work_order_id,
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
                force_simple_when_unset=False,
            )
        except Exception as exc:
            if self._is_already_done_error(exc) or self._is_no_inspection_needed_error(
                exc
            ):
                logger.info("FQC WO#{} skip/done: {}", work_order_id, exc)
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
            work_order_id=work_order_id,
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
            work_order_id=work_order_id,
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

        so_svc = SalesOrderService()
        require_notice = await BusinessConfigService().require_shipment_notice_before_delivery(
            tenant_id
        )
        deliveries: list[tuple[int, Optional[str]]] = []

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
                primary_id = int(
                    getattr(notified, "sales_delivery_id", None)
                    or notice_result.get("sales_delivery_id")
                    or 0
                )
                primary_code = (
                    getattr(notified, "sales_delivery_code", None)
                    or notice_result.get("sales_delivery_code")
                )
                if primary_id > 0:
                    deliveries.append((primary_id, primary_code))
                related = getattr(notified, "related_sales_delivery_ids", None) or []
                for row in related:
                    if isinstance(row, dict):
                        rid = int(row.get("id") or 0)
                        rcode = row.get("code") or row.get("delivery_code")
                    else:
                        rid = int(row or 0)
                        rcode = None
                    if rid > 0:
                        deliveries.append((rid, rcode))
        else:
            pushed = await so_svc.push_sales_order_to_delivery(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                created_by=operator_id,
                warehouse_id=warehouse["id"],
                warehouse_name=warehouse["name"],
            )
            delivery_id = int(pushed.get("delivery_id") or 0)
            if delivery_id > 0:
                deliveries.append((delivery_id, pushed.get("delivery_code")))
            related = pushed.get("related_sales_delivery_ids") or pushed.get(
                "delivery_ids"
            ) or []
            for row in related:
                if isinstance(row, dict):
                    rid = int(row.get("id") or row.get("delivery_id") or 0)
                    rcode = row.get("code") or row.get("delivery_code")
                else:
                    rid = int(row or 0)
                    rcode = None
                if rid > 0:
                    deliveries.append((rid, rcode))

        if not deliveries:
            raise BusinessLogicError("未能生成销售出库单，请检查订单可出库量与仓库配置")
        await self._confirm_sales_deliveries(
            tenant_id=tenant_id,
            operator_id=operator_id,
            deliveries=deliveries,
            planner=planner,
            timeline=timeline,
            step_results=step_results,
            run_id=run_id,
            label="销售出库",
        )

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
        if delivery_id <= 0:
            raise BusinessLogicError("销售预测未能生成销售出库单")
        await self._confirm_sales_deliveries(
            tenant_id=tenant_id,
            operator_id=operator_id,
            deliveries=[(delivery_id, delivery_code)],
            planner=planner,
            timeline=timeline,
            step_results=step_results,
            run_id=run_id,
            label="销售出库(预测)",
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
