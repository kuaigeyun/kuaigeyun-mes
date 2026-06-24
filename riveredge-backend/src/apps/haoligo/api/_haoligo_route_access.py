"""好力 GO 单据路由鉴权：子路径 action 在应用内显式映射（唯一真源，不回落 core 路径推断）。"""

from __future__ import annotations

from fastapi import Depends, Request
from core.api.deps.access import (
    AuthContext,
    ensure_permission_codes,
    get_auth_context,
)
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code


def haoligo_shared_workshops_read_permission_codes() -> list[str]:
    """车间列表为各模块共用的只读同步数据，满足任一业务读权限即可。"""
    modules = (
        "workspace-dashboard",
        "equipment-ledger",
        "equipment-patrol-routes",
        "equipment-documents-upkeep-sheet",
        "molds-warehouse",
        "patrol-daily-form",
        "master-data-factory-workshops",
    )
    return [build_permission_code("haoligo", mod, "read") for mod in modules]


def require_haoligo_shared_workshops_read(*, check_abac: bool = True):
    """车间同步列表：多模块 read 任一即可（非 URL 推断）。"""

    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        await ensure_permission_codes(
            auth,
            tenant_id,
            request,
            haoligo_shared_workshops_read_permission_codes(),
            require_all=False,
            check_abac=check_abac,
        )
        auth.tenant_id = tenant_id
        return auth

    return dependency


def resolve_haoligo_module_action(method: str, path: str) -> str:
    """HaoliGO 子路径 action；与 manifest STANDARD_ACTIONS 一一对应，禁止 approve/reject 合并为 audit。"""
    p = (path or "").lower()
    m = (method or "").upper()
    if "/revoke-approval" in p:
        return "audit"
    if "/mark-adjustment-complete" in p:
        return "confirm_adjustment"
    if "/dispatch" in p:
        return "dispatch"
    if "/confirm-close" in p:
        return "complete"
    if "/handle-measures" in p or "/temporary-action" in p or "/long-term-action" in p:
        return "execute"
    if "/approve" in p:
        return "approve"
    if "/reject" in p:
        return "reject"
    if "/audit" in p or "/review" in p:
        return "audit"
    if "/recall" in p:
        return "recall"
    if "/acceptance-sheets/" in p:
        if "/finalize-ledger" in p:
            return "complete"
        if "/start-trial" in p or "/complete-trial" in p:
            return "execute"
    if m in {"PUT", "PATCH"} and "/acceptance-sheets/" in p and "/rounds/" in p:
        if "/trial" in p:
            return "execute"
        return "submit"
    if m == "GET":
        return "read"
    if m in {"PUT", "PATCH"}:
        return "update"
    if m == "DELETE":
        return "delete"
    if m == "POST":
        if any(k in p for k in ("/batch-delete", "/delete", "/remove")):
            return "delete"
        if any(k in p for k in ("/import", "/upload")):
            return "import"
        if any(k in p for k in ("/export", "/download")):
            return "export"
        if any(k in p for k in ("/submit",)):
            return "submit"
        if any(k in p for k in ("/complete",)):
            return "complete"
        if any(k in p for k in ("/revoke", "/cancel", "/withdraw")):
            return "revoke"
        if any(k in p for k in ("/execute", "/confirm", "/checkin", "/checkout")):
            return "execute"
        return "create"
    raise ValueError(f"HaoliGO: unsupported HTTP method {method!r} for path {path!r}")


def _open_for_complete_query(request: Request) -> bool:
    return (request.query_params.get("open_for_complete") or "").strip().lower() in ("true", "1", "yes")


def require_haoligo_module_access(
    module_code: str,
    *,
    check_abac: bool = True,
    collection_create_permissions: list[str] | None = None,
    complete_list_source_module: str | None = None,
    complete_list_target_module: str | None = None,
):
    """模块鉴权。GET 且 open_for_complete=true 时：来源 read/complete 或 workflow 完修 create 权限（manifest 唯一真源）。"""

    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        mod = (module_code or "").strip()
        if (
            (request.method or "").upper() == "GET"
            and _open_for_complete_query(request)
            and complete_list_source_module
            and complete_list_target_module
        ):
            src_mod = complete_list_source_module.strip()
            tgt_mod = complete_list_target_module.strip()
            required = [
                build_permission_code("haoligo", src_mod, "read"),
                build_permission_code("haoligo", src_mod, "complete"),
                build_permission_code("haoligo", tgt_mod, "create"),
            ]
        elif (request.method or "").upper() == "GET" and _open_for_complete_query(request):
            required = [
                build_permission_code("haoligo", mod, "read"),
                build_permission_code("haoligo", mod, "complete"),
            ]
        else:
            action = resolve_haoligo_module_action(request.method, request.url.path)
            if (
                collection_create_permissions
                and (request.method or "").upper() == "POST"
                and action == "create"
            ):
                required = list(collection_create_permissions)
            else:
                required = [build_permission_code("haoligo", mod, action)]
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
