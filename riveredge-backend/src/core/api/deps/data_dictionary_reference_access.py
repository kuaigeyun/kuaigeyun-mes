"""数据字典只读/引用展示鉴权（含宿主隐式引用）。"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Query, status

from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.services.authorization.access_control_service import AccessControlService
from core.services.authorization.user_permission_service import UserPermissionService
from infra.api.deps.deps import get_current_user
from infra.models.user import User

_DATA_DICT_READ = "system:data-dictionary:read"
_DATA_DICT_DISPLAY = "system:data-dictionary:display"
_RESOURCE_KEY = "system:data-dictionary"


async def require_data_dictionary_reference_access(
    host_resource: Optional[str] = Query(None, description="宿主 {app}:{module}，引用 display 隐式鉴权"),
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> None:
    user_perms = await UserPermissionService.get_user_permissions(
        user_id=int(current_user.id),
        tenant_id=tenant_id,
    )
    if _DATA_DICT_READ in user_perms or _DATA_DICT_DISPLAY in user_perms:
        return

    host = (host_resource or "").strip()
    if host:
        decision = await AccessControlService.check_reference_display(
            user_id=int(current_user.id),
            tenant_id=tenant_id,
            resource_key=_RESOURCE_KEY,
            host_resource=host,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
        )
        if decision.allowed:
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="缺少数据字典读或引用展示权限",
    )
