"""FAI 首件检验服务"""

from __future__ import annotations

from statistics import mean, pstdev
from typing import Any, Dict, List, Optional

from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.fai_characteristic import FaiCharacteristic
from apps.kuaizhizao.models.fai_order import FaiOrder
from apps.kuaizhizao.models.inspection_plan import InspectionPlan, InspectionPlanStep
from apps.kuaizhizao.schemas.quality_fai import (
    FaiCharacteristicCreate,
    FaiCharacteristicResponse,
    FaiConfirmBalloonsRequest,
    FaiFairExportResponse,
    FaiImportFromPlanRequest,
    FaiOrderCreate,
    FaiOrderListResponse,
    FaiOrderResponse,
    FaiOrderUpdate,
)
from apps.kuaizhizao.services.inspection_step_spec import (
    normalize_value_type,
    resolve_numeric_effective_limits,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError

FAI_STATUSES = {"draft", "in_progress", "submitted", "approved", "rejected", "closed"}
FAI_TRIGGERS = {"new_part", "ecn", "changeover", "restart", "customer"}
EDITABLE_STATUSES = {"draft", "in_progress", "rejected"}


def judge_measured(
    measured: Optional[float],
    nominal: Optional[float],
    upper: Optional[float],
    lower: Optional[float],
) -> str:
    if measured is None:
        return "pending"
    lo = None
    hi = None
    if nominal is not None:
        if lower is not None:
            lo = nominal + lower if lower < 0 else nominal - abs(lower)
        if upper is not None:
            hi = nominal + upper
    else:
        lo, hi = lower, upper
    if lo is not None and measured < lo:
        return "fail"
    if hi is not None and measured > hi:
        return "fail"
    if lo is None and hi is None:
        return "pending"
    return "pass"


def _compute_cpk(values: List[float], lower: Optional[float], upper: Optional[float]) -> Dict[str, Any]:
    if len(values) < 2:
        return {"n": len(values), "cp": None, "cpk": None, "mean": values[0] if values else None}
    m = mean(values)
    s = pstdev(values)
    if s <= 0:
        return {"n": len(values), "cp": None, "cpk": None, "mean": m, "stdev": 0}
    cp = None
    cpu = cpl = None
    if lower is not None and upper is not None:
        cp = (upper - lower) / (6 * s)
    if upper is not None:
        cpu = (upper - m) / (3 * s)
    if lower is not None:
        cpl = (m - lower) / (3 * s)
    cpk_vals = [v for v in (cpu, cpl) if v is not None]
    cpk = min(cpk_vals) if cpk_vals else None
    return {"n": len(values), "mean": m, "stdev": s, "cp": cp, "cpk": cpk, "cpu": cpu, "cpl": cpl}


class FaiOrderService(AppBaseService[FaiOrder]):
    def __init__(self) -> None:
        super().__init__(FaiOrder)

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        return await self.generate_code(tenant_id, "FAI_ORDER_CODE", prefix="FAI")

    async def _get_order(self, tenant_id: int, order_id: int) -> FaiOrder:
        row = await FaiOrder.filter(id=order_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not row:
            raise NotFoundError("FAI 单不存在")
        return row

    async def _load_chars(self, tenant_id: int, order_id: int) -> List[FaiCharacteristic]:
        return await FaiCharacteristic.filter(
            tenant_id=tenant_id, fai_order_id=order_id, deleted_at__isnull=True
        ).order_by("sequence", "id")

    def _to_response(self, row: FaiOrder, chars: Optional[List[FaiCharacteristic]] = None) -> FaiOrderResponse:
        resp = FaiOrderResponse.model_validate(row)
        if chars is not None:
            resp.characteristics = [FaiCharacteristicResponse.model_validate(c) for c in chars]
        return resp

    def _refresh_conclusion(self, chars: List[FaiCharacteristic]) -> str:
        if not chars:
            return "pending"
        judgments = [str(c.judgment or "pending") for c in chars]
        if any(j == "fail" for j in judgments):
            return "fail"
        if all(j in ("pass", "na") for j in judgments) and any(j == "pass" for j in judgments):
            return "pass"
        if all(j == "na" for j in judgments):
            return "pass"
        return "pending"

    def _apply_char_judgment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data["judgment"] = judge_measured(
            data.get("measured_value"),
            data.get("nominal_value"),
            data.get("upper_tolerance"),
            data.get("lower_tolerance"),
        )
        return data

    async def _replace_characteristics(
        self, tenant_id: int, order_id: int, items: List[FaiCharacteristicCreate]
    ) -> List[FaiCharacteristic]:
        now = resolve_business_datetime()
        await FaiCharacteristic.filter(
            tenant_id=tenant_id, fai_order_id=order_id, deleted_at__isnull=True
        ).update(deleted_at=now)
        created: List[FaiCharacteristic] = []
        for idx, item in enumerate(items, start=1):
            payload = self._apply_char_judgment(item.model_dump())
            if not payload.get("sequence"):
                payload["sequence"] = idx
            row = await FaiCharacteristic.create(
                tenant_id=tenant_id, fai_order_id=order_id, **payload
            )
            created.append(row)
        return created

    async def create_order(self, tenant_id: int, payload: FaiOrderCreate) -> FaiOrderResponse:
        data = payload.model_dump(exclude={"characteristics"})
        if data.get("trigger_reason") not in FAI_TRIGGERS:
            raise BusinessLogicError("非法触发原因")
        data["fai_code"] = await self._ensure_code(tenant_id, data.get("fai_code"))
        data["status"] = data.get("status") or "draft"
        if data["status"] not in FAI_STATUSES:
            raise BusinessLogicError("非法状态")
        exists = await FaiOrder.filter(
            tenant_id=tenant_id, fai_code=data["fai_code"], deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError("FAI 编码已存在")
        async with in_transaction():
            row = await FaiOrder.create(tenant_id=tenant_id, **data)
            chars: List[FaiCharacteristic] = []
            if payload.characteristics:
                chars = await self._replace_characteristics(tenant_id, row.id, payload.characteristics)
                row.conclusion = self._refresh_conclusion(chars)
                await row.save()
            return self._to_response(row, chars)

    async def list_orders(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        work_order_id: Optional[int] = None,
        material_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> FaiOrderListResponse:
        query = FaiOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            query = query.filter(title__icontains=keyword)
        if status:
            query = query.filter(status=status)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if material_id:
            query = query.filter(material_id=material_id)
        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        return FaiOrderListResponse(
            items=[self._to_response(r) for r in rows],
            total=total,
        )

    async def get_order(self, tenant_id: int, order_id: int) -> FaiOrderResponse:
        row = await self._get_order(tenant_id, order_id)
        chars = await self._load_chars(tenant_id, order_id)
        return self._to_response(row, chars)

    async def update_order(
        self, tenant_id: int, order_id: int, payload: FaiOrderUpdate
    ) -> FaiOrderResponse:
        row = await self._get_order(tenant_id, order_id)
        if row.status not in EDITABLE_STATUSES and payload.characteristics is not None:
            raise BusinessLogicError("当前状态不可修改特性明细")
        if row.status in ("approved", "closed") and payload.status is None:
            raise BusinessLogicError("已批准/关闭单据不可修改")
        data = payload.model_dump(exclude_unset=True, exclude={"characteristics"})
        if "trigger_reason" in data and data["trigger_reason"] not in FAI_TRIGGERS:
            raise BusinessLogicError("非法触发原因")
        if "status" in data and data["status"] not in FAI_STATUSES:
            raise BusinessLogicError("非法状态")
        async with in_transaction():
            for key, value in data.items():
                setattr(row, key, value)
            chars = await self._load_chars(tenant_id, order_id)
            if payload.characteristics is not None:
                if row.status not in EDITABLE_STATUSES:
                    raise BusinessLogicError("当前状态不可修改特性明细")
                chars = await self._replace_characteristics(tenant_id, order_id, payload.characteristics)
            row.conclusion = self._refresh_conclusion(chars)
            if row.status == "draft" and chars:
                row.status = "in_progress"
            await row.save()
            return self._to_response(row, chars)

    async def delete_order(self, tenant_id: int, order_id: int) -> None:
        row = await self._get_order(tenant_id, order_id)
        if row.status not in ("draft", "rejected"):
            raise BusinessLogicError("仅草稿或已驳回可删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()

    async def submit(self, tenant_id: int, order_id: int) -> FaiOrderResponse:
        row = await self._get_order(tenant_id, order_id)
        if row.status not in ("draft", "in_progress", "rejected"):
            raise BusinessLogicError("当前状态不可提交")
        chars = await self._load_chars(tenant_id, order_id)
        if not chars:
            raise BusinessLogicError("请先维护特性明细")
        row.conclusion = self._refresh_conclusion(chars)
        row.status = "submitted"
        row.submitted_at = resolve_business_datetime()
        await row.save()
        return self._to_response(row, chars)

    async def approve(
        self, tenant_id: int, order_id: int, user_id: int, user_name: Optional[str] = None
    ) -> FaiOrderResponse:
        row = await self._get_order(tenant_id, order_id)
        if row.status != "submitted":
            raise BusinessLogicError("仅已提交单据可批准")
        chars = await self._load_chars(tenant_id, order_id)
        row.conclusion = self._refresh_conclusion(chars)
        if row.conclusion == "fail":
            raise BusinessLogicError("存在不合格特性，请驳回后整改")
        if row.conclusion != "pass":
            raise BusinessLogicError("特性尚未全部判定，不能批准")
        row.status = "approved"
        row.approved_at = resolve_business_datetime()
        row.approved_by = user_id
        row.approved_by_name = user_name
        row.cpk_summary = self._build_cpk_summary(chars)
        await row.save()
        return self._to_response(row, chars)

    async def reject(self, tenant_id: int, order_id: int, remarks: Optional[str] = None) -> FaiOrderResponse:
        row = await self._get_order(tenant_id, order_id)
        if row.status != "submitted":
            raise BusinessLogicError("仅已提交单据可驳回")
        row.status = "rejected"
        if remarks:
            row.remarks = ((row.remarks or "") + f"\n驳回：{remarks}").strip()
        await row.save()
        chars = await self._load_chars(tenant_id, order_id)
        return self._to_response(row, chars)

    async def close(self, tenant_id: int, order_id: int) -> FaiOrderResponse:
        row = await self._get_order(tenant_id, order_id)
        if row.status != "approved":
            raise BusinessLogicError("仅已批准单据可关闭")
        row.status = "closed"
        await row.save()
        chars = await self._load_chars(tenant_id, order_id)
        return self._to_response(row, chars)

    def _build_cpk_summary(self, chars: List[FaiCharacteristic]) -> Dict[str, Any]:
        items = []
        for c in chars:
            samples: List[float] = []
            if isinstance(c.sample_values, list):
                for v in c.sample_values:
                    try:
                        samples.append(float(v))
                    except (TypeError, ValueError):
                        continue
            if c.measured_value is not None and not samples:
                samples = [float(c.measured_value)]
            nominal = float(c.nominal_value) if c.nominal_value is not None else None
            upper = float(c.upper_tolerance) if c.upper_tolerance is not None else None
            lower = float(c.lower_tolerance) if c.lower_tolerance is not None else None
            lo = hi = None
            if nominal is not None:
                if lower is not None:
                    lo = nominal + lower if lower < 0 else nominal - abs(lower)
                if upper is not None:
                    hi = nominal + upper
            else:
                lo, hi = lower, upper
            stat = _compute_cpk(samples, lo, hi)
            items.append(
                {
                    "balloon_no": c.balloon_no,
                    "characteristic_name": c.characteristic_name,
                    **stat,
                }
            )
        return {"items": items}

    async def import_from_plan(
        self, tenant_id: int, order_id: int, payload: FaiImportFromPlanRequest
    ) -> FaiOrderResponse:
        row = await self._get_order(tenant_id, order_id)
        if row.status not in EDITABLE_STATUSES:
            raise BusinessLogicError("当前状态不可导入")
        plan = await InspectionPlan.filter(
            id=payload.inspection_plan_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if not plan:
            raise NotFoundError("质检方案不存在")
        steps = await InspectionPlanStep.filter(plan_id=plan.id).order_by("sequence").all()
        creates: List[FaiCharacteristicCreate] = []
        seq = 1
        for step in steps:
            if normalize_value_type(step.value_type) != "numeric":
                continue
            bounds = resolve_numeric_effective_limits(step.value_spec or {})
            target = bounds.get("target")
            lo = bounds.get("lower")
            hi = bounds.get("upper")
            # 存相对公差：相对名义；绝对限则换算为相对名义
            if target is not None:
                upper_tol = (hi - target) if hi is not None else None
                lower_tol = (lo - target) if lo is not None else None
            else:
                upper_tol, lower_tol = hi, lo
            creates.append(
                FaiCharacteristicCreate(
                    sequence=seq,
                    balloon_no=str(seq),
                    characteristic_name=str(step.inspection_item or f"项{seq}"),
                    nominal_value=float(target) if target is not None else None,
                    upper_tolerance=float(upper_tol) if upper_tol is not None else None,
                    lower_tolerance=float(lower_tol) if lower_tol is not None else None,
                    source_step_key=getattr(step, "step_key", None),
                    remarks=step.remarks,
                )
            )
            seq += 1
        if not creates:
            raise BusinessLogicError("方案中无数值型步骤可导入")
        async with in_transaction():
            chars = await self._replace_characteristics(tenant_id, order_id, creates)
            row.inspection_plan_id = plan.id
            row.inspection_plan_code = plan.plan_code
            row.conclusion = self._refresh_conclusion(chars)
            if row.status == "draft":
                row.status = "in_progress"
            await row.save()
            return self._to_response(row, chars)

    async def export_fair(self, tenant_id: int, order_id: int) -> FaiFairExportResponse:
        row = await self._get_order(tenant_id, order_id)
        chars = await self._load_chars(tenant_id, order_id)
        cpk = row.cpk_summary or self._build_cpk_summary(chars)
        form3 = []
        for c in chars:
            form3.append(
                {
                    "balloon_no": c.balloon_no,
                    "characteristic_name": c.characteristic_name,
                    "nominal_value": float(c.nominal_value) if c.nominal_value is not None else None,
                    "upper_tolerance": float(c.upper_tolerance) if c.upper_tolerance is not None else None,
                    "lower_tolerance": float(c.lower_tolerance) if c.lower_tolerance is not None else None,
                    "unit": c.unit,
                    "measured_value": float(c.measured_value) if c.measured_value is not None else None,
                    "judgment": c.judgment,
                    "gauge_code": c.gauge_code,
                }
            )
        return FaiFairExportResponse(
            fai_code=row.fai_code,
            form1={
                "part_number": row.part_number or row.material_code,
                "part_name": row.part_name or row.material_name,
                "drawing_no": row.drawing_no,
                "drawing_revision": row.drawing_revision,
                "serial_number": row.serial_number,
                "lot_number": row.lot_number,
                "organization_name": row.organization_name,
                "fai_code": row.fai_code,
                "trigger_reason": row.trigger_reason,
                "conclusion": row.conclusion,
                "status": row.status,
            },
            form2={
                "material_spec": row.material_spec,
                "process_spec": row.process_spec,
            },
            form3=form3,
            cpk_summary=cpk,
        )

    async def confirm_balloons(
        self, tenant_id: int, order_id: int, payload: FaiConfirmBalloonsRequest
    ) -> FaiOrderResponse:
        """三期：将气泡候选确认为特性行（候选可由外部 OCR 写入 balloon_candidates）。"""
        row = await self._get_order(tenant_id, order_id)
        if row.status not in EDITABLE_STATUSES:
            raise BusinessLogicError("当前状态不可确认气泡")
        candidates = payload.candidates or []
        if not candidates:
            raise BusinessLogicError("候选列表为空")
        creates: List[FaiCharacteristicCreate] = []
        base_seq = 0
        if not payload.replace_existing:
            existing = await self._load_chars(tenant_id, order_id)
            base_seq = len(existing)
            for e in existing:
                creates.append(
                    FaiCharacteristicCreate(
                        sequence=e.sequence,
                        balloon_no=e.balloon_no,
                        characteristic_name=e.characteristic_name,
                        nominal_value=float(e.nominal_value) if e.nominal_value is not None else None,
                        upper_tolerance=float(e.upper_tolerance) if e.upper_tolerance is not None else None,
                        lower_tolerance=float(e.lower_tolerance) if e.lower_tolerance is not None else None,
                        unit=e.unit,
                        measured_value=float(e.measured_value) if e.measured_value is not None else None,
                        sample_values=e.sample_values if isinstance(e.sample_values, list) else None,
                        judgment=e.judgment or "pending",
                        gauge_id=e.gauge_id,
                        gauge_code=e.gauge_code,
                        gauge_name=e.gauge_name,
                        source_step_key=e.source_step_key,
                        remarks=e.remarks,
                    )
                )
        for idx, raw in enumerate(candidates, start=1):
            if not isinstance(raw, dict):
                raise BusinessLogicError("候选元素须为对象")
            name = str(raw.get("characteristic_name") or raw.get("name") or "").strip()
            if not name:
                raise BusinessLogicError(f"第 {idx} 项缺少特性名称")
            creates.append(
                FaiCharacteristicCreate(
                    sequence=base_seq + idx,
                    balloon_no=str(raw.get("balloon_no") or (base_seq + idx)),
                    characteristic_name=name,
                    nominal_value=_opt_float(raw.get("nominal_value") or raw.get("nominal")),
                    upper_tolerance=_opt_float(raw.get("upper_tolerance") or raw.get("upper")),
                    lower_tolerance=_opt_float(raw.get("lower_tolerance") or raw.get("lower")),
                    unit=raw.get("unit"),
                    remarks=raw.get("note") or raw.get("remarks"),
                )
            )
        async with in_transaction():
            chars = await self._replace_characteristics(tenant_id, order_id, creates)
            row.balloon_candidates = candidates
            row.conclusion = self._refresh_conclusion(chars)
            if row.status == "draft":
                row.status = "in_progress"
            await row.save()
            return self._to_response(row, chars)

    async def maybe_create_for_work_order(
        self,
        tenant_id: int,
        *,
        work_order_id: int,
        work_order_code: str,
        material_id: Optional[int] = None,
        material_code: Optional[str] = None,
        material_name: Optional[str] = None,
        enabled: bool,
    ) -> Optional[FaiOrderResponse]:
        if not enabled:
            return None
        exists = await FaiOrder.filter(
            tenant_id=tenant_id, work_order_id=work_order_id, deleted_at__isnull=True
        ).exists()
        if exists:
            return None
        title = f"首件检验-{work_order_code or work_order_id}"
        return await self.create_order(
            tenant_id,
            FaiOrderCreate(
                title=title,
                trigger_reason="new_part",
                work_order_id=work_order_id,
                work_order_code=work_order_code,
                material_id=material_id,
                material_code=material_code,
                material_name=material_name,
                part_number=material_code,
                part_name=material_name,
            ),
        )

    async def assert_mass_reporting_allowed(self, tenant_id: int, work_order_id: int, gate_enabled: bool) -> None:
        if not gate_enabled:
            return
        rows = await FaiOrder.filter(
            tenant_id=tenant_id, work_order_id=work_order_id, deleted_at__isnull=True
        ).all()
        if not rows:
            return
        ok = any(r.status == "approved" and r.conclusion == "pass" for r in rows)
        if not ok:
            raise BusinessLogicError("该工单须完成并通过 FAI 后方可批量报工")


def _opt_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None
