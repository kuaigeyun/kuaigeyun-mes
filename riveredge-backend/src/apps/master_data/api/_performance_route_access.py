"""绩效 API 路由鉴权（权限归属 kuaizhizao manifest，托管于 master_data API）。"""

from __future__ import annotations

from fastapi import Depends, Request

from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code

_PATH_MODULE_RULES: tuple[tuple[str, str], ...] = (
    ("/holidays", "performance-holidays"),
    ("/skills", "performance-skills"),
    ("/employee-configs", "performance-employee-configs"),
    ("/employees", "performance-employee-configs"),
    ("/hourly-rates", "performance-hourly-rates"),
    ("/departments", "performance-hourly-rates"),
    ("/positions", "performance-hourly-rates"),
    ("/kpi-definitions", "performance-kpi-definitions"),
    ("/kpi-scores", "performance-kpi-definitions"),
    ("/summaries", "performance-summaries"),
    ("/calculate", "performance-summaries"),
    ("/work-groups", "performance-summaries"),
    ("/shifts", "performance-shifts"),
    ("/shift-rosters", "performance-shift-rosters"),
    ("/work-calendar", "performance-work-calendar"),
    ("/overtimes", "performance-overtimes"),
)


def resolve_performance_module(path: str) -> str:
    p = (path or "").lower()
    for segment, module in _PATH_MODULE_RULES:
        if segment in p:
            return module
    return "performance-summaries"


def resolve_performance_module_action(method: str, path: str) -> str:
    p = (path or "").lower()
    if "/export" in p:
        return "export"
    if any(k in p for k in ("/confirm", "/batch-confirm")):
        return "approve"
    if "/reopen" in p:
        return "revoke"
    if "/approve" in p or "/audit" in p:
        return "audit"
    if "/reject" in p:
        return "reject"
    m = (method or "").upper()
    if m == "GET":
        return "read"
    if m in {"PUT", "PATCH"}:
        return "update"
    if m == "DELETE":
        return "delete"
    if m == "POST":
        if "/calculate" in p or "/distribute" in p:
            return "update"
        return "create"
    raise ValueError(f"Performance: unsupported HTTP method {method!r} for path {path!r}")


def require_performance_module_access(*, check_abac: bool = False):
    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        module = resolve_performance_module(request.url.path)
        action = resolve_performance_module_action(request.method, request.url.path)
        required = [build_permission_code("kuaizhizao", module, action)]
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
