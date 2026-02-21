"""
统一访问控制依赖（FastAPI）
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, Request, status

from core.api.deps.deps import get_current_tenant
from core.services.authorization.access_control_service import AccessControlService
from infra.api.deps.deps import get_current_user
from infra.models.user import User


@dataclass
class AuthContext:
    user_id: int
    tenant_id: Optional[int]
    is_infra_admin: bool
    is_tenant_admin: bool
    request_id: str


def _make_error(
    *,
    http_status: int,
    code: str,
    message: str,
    request_id: str,
    reason: str,
    required: list[str] | None = None,
):
    raise HTTPException(
        status_code=http_status,
        detail={
            "code": code,
            "message": message,
            "details": {
                "reason": reason,
                "required": required or [],
                "request_id": request_id,
            },
        },
    )


async def get_auth_context(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> AuthContext:
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    user_id = getattr(current_user, "id", None)
    if user_id is None:
        _make_error(
            http_status=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            message="认证失败",
            request_id=request_id,
            reason="missing_user",
        )
    is_infra_superadmin = bool(getattr(current_user, "_is_infra_superadmin", False))
    is_infra_admin = bool(getattr(current_user, "is_infra_admin", False)) or is_infra_superadmin
    return AuthContext(
        user_id=int(user_id),
        tenant_id=getattr(current_user, "tenant_id", None),
        is_infra_admin=is_infra_admin,
        is_tenant_admin=bool(getattr(current_user, "is_tenant_admin", False)),
        request_id=request_id,
    )


def require_access(
    resource: str,
    action: str,
    *,
    check_abac: bool = True,
    require_all: bool = False,
    required_permissions: list[str] | None = None,
    require_tenant: bool = True,
):
    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: Optional[int] = Depends(get_current_tenant),
    ) -> AuthContext:
        if require_tenant and tenant_id is None:
            _make_error(
                http_status=status.HTTP_400_BAD_REQUEST,
                code="TENANT_CONTEXT_REQUIRED",
                message="组织上下文未设置",
                request_id=auth.request_id,
                reason="missing_tenant",
            )

        if tenant_id is None:
            _make_error(
                http_status=status.HTTP_400_BAD_REQUEST,
                code="TENANT_CONTEXT_REQUIRED",
                message="请求缺少租户上下文",
                request_id=auth.request_id,
                reason="tenant_none",
            )

        env = {
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
        }
        decision = await AccessControlService.check_access(
            user_id=auth.user_id,
            tenant_id=tenant_id,
            resource=resource,
            action=action,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
            check_abac=check_abac,
            require_all=require_all,
            required_permissions=required_permissions,
            env=env,
        )
        if not decision.allowed:
            _make_error(
                http_status=status.HTTP_403_FORBIDDEN,
                code="ACCESS_DENIED",
                message="权限不足",
                request_id=auth.request_id,
                reason=decision.reason,
                required=decision.required,
            )
        auth.tenant_id = tenant_id
        return auth

    return dependency
