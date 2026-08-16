"""用章申请服务。"""

from __future__ import annotations

from typing import Any, Optional

from apps.kuaioa.models.seal import KuaioaSealRequest
from apps.kuaioa.schemas.seal import SealRequestCreate, SealRequestUpdate
from apps.kuaioa.services.kuaioa_approval_doc_service import (
    KuaioaApprovalDocConfig,
    KuaioaApprovalDocService,
    apply_approval_decision,
)
from infra.models.user import User

_CONFIG = KuaioaApprovalDocConfig(
    model=KuaioaSealRequest,
    code_field="request_code",
    code_prefix="SR",
    entity_type="kuaioa_seal",
    audit_node_key="kuaioa_seal",
    title_prefix="用章申请",
    keyword_fields=("request_code", "title", "document_name", "applicant_name"),
    not_found_message="用章申请不存在",
)
_SVC = KuaioaApprovalDocService(_CONFIG)


class SealRequestService:
    async def list_requests(
        self, tenant_id: int, *, keyword: Optional[str] = None, status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        return await _SVC.list_rows(tenant_id, keyword=keyword, status=status)

    async def get_request(self, tenant_id: int, request_id: int) -> dict[str, Any]:
        return await _SVC.get_row(tenant_id, request_id)

    async def create_request(
        self, tenant_id: int, data: SealRequestCreate, user: User
    ) -> dict[str, Any]:
        return await _SVC.create_row(tenant_id, data.model_dump(), user)

    async def update_request(
        self, tenant_id: int, request_id: int, data: SealRequestUpdate, user: User
    ) -> dict[str, Any]:
        return await _SVC.update_row(tenant_id, request_id, data.model_dump(exclude_unset=True), user.id)

    async def delete_request(self, tenant_id: int, request_id: int, user: User) -> None:
        await _SVC.delete_row(tenant_id, request_id, user.id)

    async def submit_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        return await _SVC.submit_row(
            tenant_id,
            request_id,
            user_id,
            title_getter=lambda r: r.title,
            content_getter=lambda r: r.document_name or r.title,
        )

    async def revoke_request(self, tenant_id: int, request_id: int, user_id: int) -> dict[str, Any]:
        return await _SVC.revoke_row(tenant_id, request_id, user_id)


async def apply_seal_request_decision(
    tenant_id: int, request_id: int, approved: bool, user_id: int
) -> None:
    await apply_approval_decision(KuaioaSealRequest, tenant_id, request_id, approved, user_id)
