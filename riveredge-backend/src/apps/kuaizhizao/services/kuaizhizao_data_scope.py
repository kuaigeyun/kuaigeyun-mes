"""快制造列表数据权限（唯一路径：DataScopeService + manifest data_scope_key）。"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from core.services.authorization.data_scope_service import DataScopeService

if TYPE_CHECKING:
    from infra.models.user import User


async def apply_kuaizhizao_list_scope(
    query: Any,
    *,
    tenant_id: int,
    current_user: User | None,
    resource: str,
) -> Any:
    if current_user is None:
        return query
    return await DataScopeService.apply(
        query,
        tenant_id=tenant_id,
        user=current_user,
        resource=resource,
    )
