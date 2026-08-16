"""请假出差服务。"""

from __future__ import annotations

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
    keyword_fields=("request_code", "title", "applicant_name"),
    not_found_message="请假申请不存在",
)
_SVC = KuaioaApprovalDocService(_CONFIG)


def _calc_inclusive_days(start_at: Any, end_at: Any) -> Decimal:
    if not start_at or not end_at:
        return Decimal("0")
    start_d = to_site_date(start_at)
    end_d = to_site_date(end_at)
    if end_d < start_d:
        raise BusinessLogicError("结束时间不能早于开始时间")
    return Decimal(str((end_d - start_d).days + 1))


def _normalize_leave_payload(payload: dict[str, Any]) -> dict[str, Any]:
    start_at = payload.get("start_at")
    end_at = payload.get("end_at")
    if start_at and end_at:
        computed = _calc_inclusive_days(start_at, end_at)
        if payload.get("days") is None:
            payload["days"] = computed
    return payload


def _payload_from_create(data: LeaveRequestCreate) -> dict[str, Any]:
    payload = {
        "leave_type": data.leave_type,
        "title": data.title,
        "start_at": parse_business_datetime(data.start_at),
        "end_at": parse_business_datetime(data.end_at),
        "days": data.days,
        "destination": data.destination,
        "reason": data.reason,
        "department_name": data.department_name,
        "notes": data.notes,
    }
    return _normalize_leave_payload(payload)


def _payload_from_update(data: LeaveRequestUpdate) -> dict[str, Any]:
    payload = data.model_dump(exclude_unset=True)
    if "start_at" in payload:
        payload["start_at"] = parse_business_datetime(payload["start_at"])
    if "end_at" in payload:
        payload["end_at"] = parse_business_datetime(payload["end_at"])
    return _normalize_leave_payload(payload)


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
        return await _SVC.create_row(tenant_id, _payload_from_create(data), user)

    async def update_request(
        self, tenant_id: int, request_id: int, data: LeaveRequestUpdate, user: User
    ) -> dict[str, Any]:
        return await _SVC.update_row(tenant_id, request_id, _payload_from_update(data), user.id)

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
    await apply_approval_decision(KuaioaLeaveRequest, tenant_id, request_id, approved, user_id)
