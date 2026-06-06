"""好力 GO 单据路由鉴权：子路径 action 在应用内显式映射（唯一真源，不回落 core 路径推断）。"""

from __future__ import annotations

from fastapi import Depends, Request
from apps.haoligo.authorization.workflow_permissions import permission_codes_for_complete_create
from core.api.deps.access import (
    AuthContext,
    ensure_permission_codes,
    get_auth_context,
)
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code


def resolve_haoligo_module_action(method: str, path: str) -> str:
    """HaoliGO 子路径 action；与 manifest STANDARD_ACTIONS 一一对应，禁止 approve/reject 合并为 audit。"""
    p = (path or "").lower()
    if "/recall-and-retrial" in p:
        return "recall"
    if "/revoke-approval" in p:
        return "audit"
    if "/mark-adjustment-complete" in p:
        return "confirm_adjustment"
    if "/dispatch" in p:
        return "dispatch"
    if "/approve" in p:
        return "approve"
    if "/reject" in p:
        return "reject"
    if "/audit" in p or "/review" in p:
        return "audit"
    if "/recall" in p:
        return "recall"
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
        if any(k in p for k in ("/import", "/upload")):
            return "import"
        if any(k in p for k in ("/export", "/download")):
            return "export"
        if any(k in p for k in ("/submit",)):
            return "submit"
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
            required = permission_codes_for_complete_create(
                source_resource=f"haoligo:{complete_list_source_module.strip()}",
                target_resource=f"haoligo:{complete_list_target_module.strip()}",
            )
            # 设备维保单无来源 :complete，workflow 仅 read + 目标 create
            if complete_list_source_module == "equipment-documents-upkeep-sheet":
                required = [
                    build_permission_code("haoligo", complete_list_source_module, "read"),
                    build_permission_code("haoligo", complete_list_target_module, "create"),
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
