"""请假出差服务。"""

from __future__ import annotations

from datetime import datetime, time
from decimal import Decimal
from typing import Any, Optional

from apps.kuaioa.models.leave import KuaioaLeaveRequest
from apps.kuaioa.schemas.leave import LeaveRequestCreate, LeaveRequestUpdate
from apps.kuaioa.services.kuaioa_approval_doc_service import (
    KuaioaApprovalDocConfig,
    KuaioaApprovalDocService,
    apply_approval_decision,
    parse_business_datetime,
)
from core.utils.timezone_utils import to_site_date
from infra.exceptions.exceptions import BusinessLogicError
from infra.models.user import User

_CONFIG = KuaioaApprovalDocConfig(
    model=KuaioaLeaveRequest,
    code_field="request_code",
    code_prefix="LR",
    entity_type="kuaioa_leave",
    audit_node_key="kuaioa_leave",
    title_prefix="请假出差",
    keyword_fields=("request_code", "title", "applicant_name", "employee_name", "workshop_name"),
    not_found_message="请假申请不存在",
)
_SVC = KuaioaApprovalDocService(_CONFIG)

_STANDARD_DAY_HOURS = Decimal("8")


def _calc_inclusive_days(start_at: Any, end_at: Any) -> Decimal:
    if not start_at or not end_at:
        return Decimal("0")
    start_d = to_site_date(start_at)
    end_d = to_site_date(end_at)
    if end_d < start_d:
        raise BusinessLogicError("结束时间不能早于开始时间")
    return Decimal(str((end_d - start_d).days + 1))


def _hours_between(start_at: datetime, end_at: datetime) -> Decimal:
    if end_at < start_at:
        raise BusinessLogicError("结束时间不能早于开始时间")
    seconds = (end_at - start_at).total_seconds()
    hours = Decimal(str(seconds)) / Decimal("3600")
    return hours.quantize(Decimal("0.01"))


def _normalize_leave_payload(payload: dict[str, Any], *, partial: bool = False) -> dict[str, Any]:
    start_at = payload.get("start_at")
    end_at = payload.get("end_at")
    if start_at and end_at:
        if end_at < start_at:
            raise BusinessLogicError("结束时间不能早于开始时间")
        computed_days = _calc_inclusive_days(start_at, end_at)
        start_d = to_site_date(start_at)
        end_d = to_site_date(end_at)
        span_hours = _hours_between(start_at, end_at)
        if payload.get("leave_hours") is None and start_d == end_d and span_hours < _STANDARD_DAY_HOURS:
            payload["leave_hours"] = span_hours
        leave_hours = payload.get("leave_hours")
        if leave_hours is not None:
            lh = Decimal(str(leave_hours))
            if lh < 0:
                raise BusinessLogicError("请假小时不能为负")
            if lh > _STANDARD_DAY_HOURS * computed_days:
                raise BusinessLogicError("请假小时超过请假天数对应工时")
            payload["leave_hours"] = lh
            if payload.get("days") is None and lh < _STANDARD_DAY_HOURS and start_d == end_d:
                payload["days"] = (lh / _STANDARD_DAY_HOURS).quantize(Decimal("0.01"))
        if payload.get("days") is None:
            payload["days"] = computed_days
    if "deduct_enabled" in payload or not partial:
        deduct_enabled = bool(payload.get("deduct_enabled", False))
        payload["deduct_enabled"] = deduct_enabled
        if not deduct_enabled:
            payload["deduct_amount"] = None
        elif payload.get("deduct_amount") is not None:
            amt = Decimal(str(payload["deduct_amount"]))
            if amt < 0:
                raise BusinessLogicError("扣款金额不能为负")
            payload["deduct_amount"] = amt
    elif "deduct_amount" in payload and payload.get("deduct_amount") is not None:
        amt = Decimal(str(payload["deduct_amount"]))
        if amt < 0:
            raise BusinessLogicError("扣款金额不能为负")
        payload["deduct_amount"] = amt
    return payload


def _payload_from_create(data: LeaveRequestCreate) -> dict[str, Any]:
    payload = {
        "leave_type": data.leave_type,
        "title": data.title,
        "start_at": parse_business_datetime(data.start_at),
        "end_at": parse_business_datetime(data.end_at),
        "days": data.days,
        "leave_hours": data.leave_hours,
        "deduct_enabled": bool(data.deduct_enabled),
        "deduct_amount": data.deduct_amount,
        "workshop_name": (data.workshop_name or "").strip() or None,
        "production_line_name": (data.production_line_name or "").strip() or None,
        "employee_id": data.employee_id,
        "destination": data.destination,
        "reason": data.reason,
        "department_name": data.department_name,
        "notes": data.notes,
    }
    return _normalize_leave_payload(payload, partial=False)


def _payload_from_update(data: LeaveRequestUpdate) -> dict[str, Any]:
    payload = data.model_dump(exclude_unset=True)
    if "start_at" in payload:
        payload["start_at"] = parse_business_datetime(payload["start_at"])
    if "end_at" in payload:
        payload["end_at"] = parse_business_datetime(payload["end_at"])
    if "workshop_name" in payload and payload["workshop_name"] is not None:
        payload["workshop_name"] = str(payload["workshop_name"]).strip() or None
    if "production_line_name" in payload and payload["production_line_name"] is not None:
        payload["production_line_name"] = str(payload["production_line_name"]).strip() or None
    return _normalize_leave_payload(payload, partial=True)


async def _attach_employee_snapshot(tenant_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    eid = payload.get("employee_id")
    if eid is None:
        return payload
    from apps.kuaioa.models.employee import KuaioaEmployeeProfile

    emp = await KuaioaEmployeeProfile.get_or_none(
        id=int(eid), tenant_id=tenant_id, deleted_at__isnull=True
    )
    if not emp:
        raise BusinessLogicError("员工档案不存在")
    payload["employee_id"] = int(emp.id)
    payload["employee_name"] = emp.full_name
    if not payload.get("workshop_name") and emp.workshop_name:
        payload["workshop_name"] = emp.workshop_name
    if not payload.get("production_line_name") and emp.production_line_name:
        payload["production_line_name"] = emp.production_line_name
    return payload


def leave_hours_for_date(
    leave: KuaioaLeaveRequest, work_date, standard: Decimal
) -> Decimal:
    """计算某一考勤日应扣减的请假小时。"""
    if not leave.start_at or not leave.end_at:
        return Decimal("0")
    start_at = leave.start_at
    end_at = leave.end_at
    start_d = to_site_date(start_at)
    end_d = to_site_date(end_at)
    if work_date < start_d or work_date > end_d:
        return Decimal("0")

    explicit = leave.leave_hours
    if explicit is not None and start_d == end_d:
        return min(Decimal(str(explicit)), standard)

    day_start = datetime.combine(work_date, time.min, tzinfo=start_at.tzinfo)
    day_end = datetime.combine(work_date, time.max, tzinfo=start_at.tzinfo)
    seg_start = max(start_at, day_start)
    seg_end = min(end_at, day_end)
    if seg_end <= seg_start:
        return Decimal("0")
    hours = _hours_between(seg_start, seg_end)
    if start_d == end_d:
        return min(hours, standard)
    if start_d < work_date < end_d:
        return standard
    return min(hours, standard)


class LeaveRequestService:
    async def list_requests(
        self, tenant_id: int, *, keyword: Optional[str] = None, status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        return await _SVC.list_rows(tenant_id, keyword=keyword, status=status)

    async def get_request(self, tenant_id: int, request_id: int) -> dict[str, Any]:
        return await _SVC.get_row(tenant_id, request_id)

    async def create_request(
        self, tenant_id: int, data: LeaveRequestCreate, user: User
    ) -> dict[str, Any]:
        payload = await _attach_employee_snapshot(tenant_id, _payload_from_create(data))
        return await _SVC.create_row(tenant_id, payload, user)

    async def update_request(
        self, tenant_id: int, request_id: int, data: LeaveRequestUpdate, user: User
    ) -> dict[str, Any]:
        payload = _payload_from_update(data)
        if "employee_id" in payload or "workshop_name" in payload:
            payload = await _attach_employee_snapshot(tenant_id, payload)
        return await _SVC.update_row(tenant_id, request_id, payload, user.id)

    async def delete_request(self, tenant_id: int, request_id: int, user: User) -> None:
        await _SVC.delete_row(tenant_id, request_id, user.id)

    async def submit_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        return await _SVC.submit_row(
            tenant_id,
            request_id,
            user_id,
            title_getter=lambda r: r.title,
            content_getter=lambda r: r.reason or r.title,
        )

    async def revoke_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        return await _SVC.revoke_row(tenant_id, request_id, user_id)


async def apply_leave_request_decision(
    tenant_id: int, request_id: int, approved: bool, user_id: int
) -> None:
    await apply_approval_decision(
        KuaioaLeaveRequest,
        tenant_id,
        request_id,
        approved,
        user_id,
        audit_node_key=_CONFIG.audit_node_key,
        entity_type=_CONFIG.entity_type,
        doc_label=_CONFIG.title_prefix,
    )
    if not approved:
        return
    leave = await KuaioaLeaveRequest.get_or_none(
        id=request_id, tenant_id=tenant_id, deleted_at__isnull=True
    )
    if not leave:
        return
    from apps.kuaioa.services.attendance_service import AttendanceService

    await AttendanceService().apply_leave_to_attendance(tenant_id, leave, user_id)
