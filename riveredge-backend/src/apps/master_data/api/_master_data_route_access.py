"""主数据路由鉴权：子路径 module + action 显式映射（不回落 core 路径推断）。"""

from __future__ import annotations

from fastapi import Depends, Request

from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code

# 路径片段 → manifest module（master-data 下，不含 app 前缀）
_PATH_MODULE_RULES: tuple[tuple[str, str], ...] = (
    ("/process/drawings", "process:drawing"),
    ("/defect-types", "process:defect-type"),
    ("/operations", "process:operation"),
    ("/route-templates", "process:route"),
    ("/routes", "process:route"),
    ("/product-process", "process:route"),
    ("/sop", "process:sop"),
    # BOM / 工程变更：manifest 为 process:engineering-bom（须先于泛化 /materials）
    ("/bom-change-records", "process:engineering-bom"),
    ("/materials/bom", "process:engineering-bom"),
    ("/warehouses", "warehouse:warehouse"),
    ("/storage-areas", "warehouse:storage-area"),
    ("/storage-locations", "warehouse:storage-location"),
    ("/production-lines", "factory:production-line"),
    ("/work-centers", "factory:work-center"),
    ("/workstations", "factory:workstation"),
    ("/work-groups", "factory:work-group"),
    ("/workshops", "factory:workshop"),
    ("/plants", "factory:plant"),
)

# manifest 无 :approve、审核走 :audit 的模块
_AUDIT_APPROVE_MODULES = frozenset({
    "material",
    "process:engineering-bom",
})


def resolve_master_data_effective_module(module_code: str, path: str) -> str:
    """伞形 module（process/material/warehouse/factory）按路径细化到子模块。"""
    code = (module_code or "").strip().lower()
    if ":" in code:
        return code
    p = (path or "").lower()
    for segment, sub in _PATH_MODULE_RULES:
        if segment in p:
            return sub
    return code


def resolve_master_data_module_action(
    method: str,
    path: str,
    *,
    module_code: str = "",
    resolve_print: bool = True,
) -> str:
    p = (path or "").lower()
    if resolve_print and "/print" in p:
        return "print"
    if "/release" in p:
        return "release"
    if "/obsolete" in p:
        # engineering-bom 无 obsolete 码，失效走 update
        if module_code == "process:engineering-bom":
            return "update"
        return "obsolete"
    if "/approve" in p or "/batch-approve" in p:
        if module_code in _AUDIT_APPROVE_MODULES:
            return "audit"
        return "approve"
    if "/reject" in p:
        return "reject"
    if "/audit" in p or "/review" in p:
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
        if any(k in p for k in ("/import", "/upload", "/import-step-bom")):
            return "import"
        if any(k in p for k in ("/export", "/download")):
            return "export"
        if "/submit" in p:
            return "submit"
        if any(k in p for k in ("/revoke", "/cancel", "/withdraw")):
            return "revoke"
        if any(k in p for k in ("/execute", "/confirm", "/checkin", "/checkout")):
            return "execute"
        if "/revision" in p:
            return "create"
        return "create"
    raise ValueError(f"MasterData: unsupported HTTP method {method!r} for path {path!r}")


def require_master_data_module_access(
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
        effective = resolve_master_data_effective_module(module_code, request.url.path)
        action = resolve_master_data_module_action(
            request.method,
            request.url.path,
            module_code=effective,
            resolve_print=resolve_print,
        )
        if (
            collection_create_permissions
            and (request.method or "").upper() == "POST"
            and action == "create"
        ):
            required = list(collection_create_permissions)
        else:
            required = [build_permission_code("master-data", effective, action)]
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
