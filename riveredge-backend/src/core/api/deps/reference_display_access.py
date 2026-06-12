"""统一的引用展示鉴权依赖（read/display + host_resource 隐式授权）。"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Query, status

from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.services.authorization.access_control_service import AccessControlService
from infra.api.deps.deps import get_current_user
from infra.models.user import User


def require_reference_display_access(resource_key: str, denied_detail: str):
    key = (resource_key or "").strip().lower()

    async def dependency(
        host_resource: Optional[str] = Query(None, description="宿主 {app}:{module}，引用 display 隐式鉴权"),
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
        current_user: User = Depends(get_current_user),
    ) -> None:
        decision = await AccessControlService.check_reference_display(
            user_id=int(current_user.id),
            tenant_id=tenant_id,
            resource_key=key,
            host_resource=(host_resource or "").strip() or None,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
        )
        if decision.allowed:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=denied_detail,
        )

    return dependency

