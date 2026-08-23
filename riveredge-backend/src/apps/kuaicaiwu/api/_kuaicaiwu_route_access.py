"""快财务路由鉴权：子路径 action 显式映射（不回落 core 路径推断）。"""

from __future__ import annotations

from fastapi import Depends, Request

from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code


def resolve_kuaicaiwu_module_action(
    method: str,
    path: str,
    *,
    module_code: str = "",
    resolve_print: bool = True,
) -> str:
    p = (path or "").lower()
    if resolve_print and "/print" in p:
        return "print"
    if "/approve" in p:
        return "approve"
    if "/reject" in p:
        return "reject"
    if "/audit" in p or "/review" in p or "/unreview" in p:
        return "audit"
    if "/unapprove" in p:
        return "revoke"
    m = (method or "").upper()
    if m == "GET":
        return "read"
    if m in {"PUT", "PATCH"}:
        return "update"
    if m == "DELETE":
        return "delete"
    if m == "POST":
        if any(k in p for k in ("/batch-delete", "/delete", "/remove")):
            return "delete"
        if any(k in p for k in ("/import", "/upload", "/import-statement")):
            return "import"
        if any(k in p for k in ("/export", "/download")):
            return "export"
        if "/submit" in p:
            return "submit"
        if any(k in p for k in ("/revoke", "/cancel", "/withdraw")):
            return "revoke"
        if any(
            k in p
            for k in (
                "/execute",
                "/confirm",
                "/post",
                "/unpost",
                "/calculate",
                "/settlement",
                "/monthly-settlement",
                "/realtime-refresh",
                "/period-close",
                "/reopen",
                "/finish-init",
                "/carry-profit-loss",
                "/seed",
                "/sync-enterprise",
                "/match",
                "/generate-from-events",
                "/run",
                "/apply",
                "/batch-apply",
            )
        ):
            return "execute"
        if "/obsolete" in p:
            return "obsolete"
        return "create"
    raise ValueError(f"Kuaicaiwu: unsupported HTTP method {method!r} for path {path!r}")


def require_kuaicaiwu_module_access(
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
        action = resolve_kuaicaiwu_module_action(
            request.method,
            request.url.path,
            module_code=module_code,
            resolve_print=resolve_print,
        )
        if (
            collection_create_permissions
            and (request.method or "").upper() == "POST"
            and action == "create"
        ):
            required = list(collection_create_permissions)
        else:
            required = [build_permission_code("kuaicaiwu", module_code, action)]
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
