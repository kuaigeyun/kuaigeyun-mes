"""快智造路由鉴权：打印 / 派工等子路径 action 在应用内显式映射。"""

from __future__ import annotations

from fastapi import Depends, Request

from core.api.deps.access import (
    AuthContext,
    _resolve_action_by_request,
    ensure_permission_codes,
    get_auth_context,
)
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code


def resolve_kuaizhizao_module_action(module_code: str, method: str, path: str, *, resolve_print: bool = True) -> str:
    p = (path or "").lower()
    if resolve_print and "/print" in p:
        return "print"
    if module_code == "work-order" and "/operations/" in p and "/dispatch" in p:
        return "assign"
    return _resolve_action_by_request(method, path)


def require_kuaizhizao_module_access(
    module_code: str,
    *,
    check_abac: bool = True,
    collection_create_permissions: list[str] | None = None,
    resolve_print: bool = True,
):
    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        action = resolve_kuaizhizao_module_action(
            module_code,
            request.method,
            request.url.path,
            resolve_print=resolve_print,
        )
        if (
            collection_create_permissions
            and (request.method or "").upper() == "POST"
            and action == "create"
        ):
            required = list(collection_create_permissions)
        else:
            required = [build_permission_code("kuaizhizao", module_code, action)]
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
