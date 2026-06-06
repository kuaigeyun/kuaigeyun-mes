"""
统一访问控制依赖（FastAPI）
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from loguru import logger

from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import validate_permission_code
from core.services.authorization.access_control_service import AccessControlService
from core.services.authorization.menu_resource_resolver import parse_permission_code
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
    logger.warning(
        "access_denied_or_invalid code={} reason={} request_id={} required={}",
        code,
        reason,
        request_id,
        required or [],
    )
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


async def ensure_permission_codes(
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    permission_codes: list[str],
    *,
    require_all: bool = False,
    check_abac: bool = False,
) -> None:
    """命令式权限码校验（供应用内细粒度 RBAC helper 复用）。"""
    codes = [c.strip() for c in permission_codes if (c or "").strip()]
    for code in codes:
        err = validate_permission_code(code)
        if err:
            raise ValueError(f"无效权限码：{err}")
    parsed = parse_permission_code(codes[0]) if codes else None
    resource = f"{parsed[0]}:{parsed[1]}" if parsed else ""
    action = parsed[2] if parsed else ""
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
        required_permissions=codes,
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


def require_permission_codes(
    *permission_codes: str,
    require_all: bool = False,
    check_abac: bool = False,
    require_tenant: bool = True,
):
    """
    【推荐】显式权限码鉴权：只校验 manifest 已声明的完整权限码，不推断 URL。

    - RBAC：required_permissions 与角色授予的 codes 精确匹配
    - check_abac 默认 False，避免用泛化 resource/action 误拦应用内细粒度授权
    """
    codes = [c.strip() for c in permission_codes if (c or "").strip()]
    for code in codes:
        err = validate_permission_code(code)
        if err:
            raise ValueError(f"无效权限码：{err}")

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
        await ensure_permission_codes(
            auth,
            tenant_id,
            request,
            codes,
            require_all=require_all,
            check_abac=check_abac,
        )
        auth.tenant_id = tenant_id
        return auth

    return dependency


def _resolve_action_by_request(method: str, path: str) -> str:
    """
    【遗留】根据 HTTP 方法与路径片段推断 action，仅服务于 require_module_access。

    新路由禁止使用此推断表达业务语义；请改用 require_permission_codes 或在
    require_module_access 上配置 collection_create_permissions 等显式列表。
    """
    m = (method or "").upper()
    p = (path or "").lower()
    if m == "GET":
        return "read"
    if m in {"PUT", "PATCH"}:
        return "update"
    if m == "DELETE":
        return "delete"
    # POST 场景按路径语义细分，避免所有写请求都映射 create
    if any(k in p for k in ["/batch-delete", "/delete", "/remove"]):
        return "delete"
    if any(k in p for k in ["/import", "/upload"]):
        return "import"
    if any(k in p for k in ["/export", "/download"]):
        return "export"
    if any(k in p for k in ["/approve", "/audit", "/reject", "/review"]):
        return "audit"
    if any(k in p for k in ["/submit"]):
        return "submit"
    if any(k in p for k in ["/revoke", "/cancel", "/withdraw"]):
        return "revoke"
    if any(k in p for k in ["/execute", "/confirm", "/checkin", "/checkout"]):
        return "execute"
    return "create"


def require_module_access(
    app_code: str,
    module_code: str,
    *,
    check_abac: bool = True,
    require_tenant: bool = True,
    collection_create_permissions: list[str] | None = None,
    route_permission_codes: list[str] | None = None,
):
    """
    按模块鉴权（标准 CRUD 列表页/REST）。

    - 默认仍用 _resolve_action_by_request 推断 action（遗留，逐步淘汰）
    - route_permission_codes：若提供，则完全改用显式权限码（推荐用于子路径 API）

    collection_create_permissions：集合 POST 且推断为 create 时，满足其一即可。
    """
    resource = f"{(app_code or '').strip()}:{(module_code or '').strip()}".strip(":")

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

        if route_permission_codes:
            required = [c.strip() for c in route_permission_codes if (c or "").strip()]
            for code in required:
                err = validate_permission_code(code)
                if err:
                    _make_error(
                        http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        code="INVALID_PERMISSION_CONFIG",
                        message=err,
                        request_id=auth.request_id,
                        reason="invalid_route_permission_code",
                    )
            parsed = parse_permission_code(required[0]) if required else None
            action = parsed[2] if parsed else ""
        else:
            action = _resolve_action_by_request(request.method, request.url.path)
            if (
                collection_create_permissions
                and (request.method or "").upper() == "POST"
                and action == "create"
            ):
                required = list(collection_create_permissions)
            else:
                required = [AccessControlService.build_permission_code(resource, action)]
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
            require_all=False,
            required_permissions=required,
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
