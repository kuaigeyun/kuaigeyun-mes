"""快智造路由鉴权：子路径 action 在应用内显式映射（唯一真源，不回落 core 路径推断）。"""

from __future__ import annotations

from fastapi import Depends, Request

from core.api.deps.access import (
    AuthContext,
    ensure_permission_codes,
    get_auth_context,
)
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code

# 审核走 audit 而非 approve 的模块（与 manifest 一致）
_AUDIT_APPROVE_MODULES = frozenset({
    "purchase-order-change",
    "sales-order-change",
})


def resolve_kuaizhizao_module_action(
    method: str,
    path: str,
    *,
    module_code: str = "",
    resolve_print: bool = True,
) -> str:
    """快智造子路径 action；与 manifest STANDARD_ACTIONS 一一对应。"""
    p = (path or "").lower()
    if resolve_print and "/print" in p:
        return "print"
    if module_code == "work-order" and "/operations/" in p and "/dispatch" in p:
        return "assign"
    if "/revoke-approval" in p:
        return "audit"
    if "/mark-adjustment-complete" in p:
        return "confirm_adjustment"
    if "/dispatch" in p:
        return "dispatch"
    if "/release" in p:
        return "submit"
    if "/freeze" in p or "/unfreeze" in p:
        return "revoke"
    if "/unapprove" in p:
        return "revoke"
    if "/approve" in p:
        if module_code in _AUDIT_APPROVE_MODULES:
            return "audit"
        return "approve"
    if "/reject" in p:
        return "reject"
    if "/audit" in p or "/review" in p:
        return "audit"
    if "/recall" in p:
        return "recall"
    if "/convert-to-order" in p:
        return "update"
    if "/confirm-customer" in p:
        return "execute"
    if "/cancel-customer-confirm" in p:
        return "execute"
    if "/close" in p:
        return "execute"
    if "/conduct" in p:
        return "update"
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
    raise ValueError(f"Kuaizhizao: unsupported HTTP method {method!r} for path {path!r}")


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


_QUALITY_EXECUTION_PATH_MODULES: tuple[tuple[str, str], ...] = (
    ("/incoming-inspections", "quality-management-incoming-inspection"),
    ("/process-inspections", "quality-management-process-inspection"),
    ("/finished-goods-inspections", "quality-management-finished-goods-inspection"),
    ("/quality-inspection-stage-toggles", "quality-management-inspection-plans"),
    ("/quality-effective-config", "quality-management-inspection-plans"),
)


def resolve_kuaizhizao_quality_execution_module(path: str) -> str:
    """按 URL 前缀映射质检执行 API 到 manifest 模块。"""
    p = (path or "").lower()
    for prefix, module_code in _QUALITY_EXECUTION_PATH_MODULES:
        if prefix in p:
            return module_code
    raise ValueError(f"Kuaizhizao quality execution: unmapped path {path!r}")


def require_kuaizhizao_quality_execution_access(
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
        module_code = resolve_kuaizhizao_quality_execution_module(request.url.path)
        action = resolve_kuaizhizao_module_action(
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


_PRODUCTIONS_PATH_MODULES: tuple[tuple[str, str], ...] = (
    ("/sales-forecasts", "sales-forecast"),
    ("/stocktakings", "warehouse-management-stocktaking"),
    ("/inventory-transfers", "warehouse-management-inventory-transfer"),
    ("/bin-transfers", "warehouse-management-inventory-transfer"),
    ("/assembly-templates", "warehouse-management-assembly-orders"),
    ("/assembly-orders", "warehouse-management-assembly-orders"),
    ("/disassembly-orders", "warehouse-management-disassembly-orders"),
    ("/outsource-work-orders", "outsource-order"),
    ("/outsource-material-issues", "outsource-order"),
    ("/outsource-material-returns", "outsource-order"),
    ("/outsource-product-returns", "outsource-order"),
    ("/outsource-settlements", "outsource-order"),
    ("/work-orders", "work-order"),
    ("/production-pickings", "inbound"),
    ("/semi-finished-goods-receipts", "inbound"),
    ("/finished-goods-receipts", "inbound"),
    ("/purchase-orders/", "purchase-order"),
    ("/suppliers/", "purchase-order"),
    ("/customers/", "sales-order"),
    ("/sales-orders/", "sales-order"),
    ("/reporting", "production-execution-reporting"),
    ("/scrap", "production-execution-reporting"),
    ("/defect", "production-execution-reporting"),
    ("/material-binding", "production-execution-reporting"),
)


def resolve_kuaizhizao_productions_module(path: str) -> str:
    """productions 聚合路由内按 URL 映射 manifest 模块（避免统一走报工权限）。"""
    p = (path or "").lower()
    for prefix, module_code in _PRODUCTIONS_PATH_MODULES:
        if prefix in p:
            return module_code
    return "production-execution-reporting"


def require_kuaizhizao_productions_access(
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
        module_code = resolve_kuaizhizao_productions_module(request.url.path)
        action = resolve_kuaizhizao_module_action(
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


_WORK_ORDER_PATH_MODULES: tuple[tuple[str, str], ...] = (
    ("/rework-orders", "rework-order"),
)


def resolve_kuaizhizao_work_order_module(path: str) -> str:
    p = (path or "").lower()
    for prefix, module_code in _WORK_ORDER_PATH_MODULES:
        if prefix in p:
            return module_code
    return "work-order"


def require_kuaizhizao_work_order_access(
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
        module_code = resolve_kuaizhizao_work_order_module(request.url.path)
        action = resolve_kuaizhizao_module_action(
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


_WAREHOUSE_EXECUTION_PATH_MODULES: tuple[tuple[str, str], ...] = (
    ("/inventory/customer-material-registration/mapping-rules", "warehouse-management-barcode-mapping-rules"),
    ("/inventory/customer-material-registration", "warehouse-management-customer-material-registration"),
    ("/inventory-alert-rules", "warehouse-management-inventory-alert"),
    ("/inventory-alerts", "warehouse-management-inventory-alert"),
    ("/inventory-analysis", "warehouse-management-inventory"),
    ("/warehouse-dashboard", "inventory"),
    ("/packing-bindings", "production-execution-packing-binding"),
    ("/packing-binding", "production-execution-packing-binding"),
    ("/production-pickings", "inbound"),
    ("/production-returns", "inbound"),
    ("/other-inbounds", "other-inbound"),
    ("/other-outbounds", "other-outbound"),
    ("/material-borrows", "material-borrow"),
    ("/material-returns", "material-return"),
    ("/finished-goods-receipts", "inbound"),
    ("/semi-finished-goods-receipts", "inbound"),
    ("/sales-deliveries", "outbound"),
    ("/sales-returns", "sales-return"),
    ("/purchase-receipts", "inbound"),
    ("/purchase-returns", "purchase-return"),
    ("/replenishment-suggestions", "warehouse-management-replenishment-suggestions"),
    ("/batching-center", "warehouse-management-batching-center"),
    ("/batching-orders", "warehouse-management-batching-center"),
)


def resolve_kuaizhizao_warehouse_execution_module(path: str) -> str:
    """仓储执行 API 按 URL 前缀映射 manifest 模块。"""
    p = (path or "").lower()
    for prefix, module_code in _WAREHOUSE_EXECUTION_PATH_MODULES:
        if prefix in p:
            return module_code
    return "warehouse-management-inventory"


def require_kuaizhizao_warehouse_execution_access(
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
        module_code = resolve_kuaizhizao_warehouse_execution_module(request.url.path)
        action = resolve_kuaizhizao_module_action(
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
