"""好力 GO 单据路由鉴权：子路径 action 在应用内显式映射。"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Request

from core.api.deps.access import (
    AuthContext,
    _resolve_action_by_request,
    ensure_permission_codes,
    get_auth_context,
)
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code


def resolve_haoligo_module_action(method: str, path: str) -> str:
    p = (path or "").lower()
    if "/revoke-approval" in p:
        return "audit"
    if "/dispatch" in p:
        return "dispatch"
    if "/mark-adjustment-complete" in p:
        return "confirm_adjustment"
    if "/recall" in p:
        return "recall"
    return _resolve_action_by_request(method, path)


def require_haoligo_module_access(
    module_code: str,
    *,
    check_abac: bool = True,
    collection_create_permissions: list[str] | None = None,
):
    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        action = resolve_haoligo_module_action(request.method, request.url.path)
        if (
            collection_create_permissions
            and (request.method or "").upper() == "POST"
            and action == "create"
        ):
            required = list(collection_create_permissions)
        else:
            required = [build_permission_code("haoligo", module_code, action)]
        await ensure_permission_codes(
            auth,
            tenant_id,
            request,
            required,
            require_all=False,
            check_abac=check_abac,
        )
        auth.tenant_id = tenant_id
        return auth

    return dependency
