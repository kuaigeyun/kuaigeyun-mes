"""好力 GO 设备 API：按 URL 映射 manifest module（唯一真源，禁止 umbrella equipment / equipment-documents）。"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status

from apps.haoligo.api._haoligo_route_access import resolve_haoligo_module_action
from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code


def _workshops_read_permission_codes() -> list[str]:
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


def resolve_equipment_master_module(path: str) -> str:
    """设备主数据 /equipment/* → manifest module。"""
    p = (path or "").lower()
    if "/inspection-param-sets" in p:
        return "equipment-inspection-param-sets"
    if "/inspection-params" in p:
        return "equipment-inspection-params"
    if "/manufacturers" in p:
        return "equipment-manufacturers"
    if "/categories" in p:
        return "equipment-categories"
    if "/equipments" in p:
        return "equipment-ledger"
    if "/patrol-routes" in p:
        return "equipment-patrol-routes"
    if "/workshops" in p:
        return "master-data-factory-workshops"
    raise ValueError(f"HaoliGO equipment master: unmapped path {path!r}")


def resolve_equipment_document_module(path: str) -> str:
    """设备单据 /equipment/* → manifest module。"""
    p = (path or "").lower()
    if "/spot-checks" in p:
        return "equipment-documents-spot-check"
    if "/route-patrols" in p:
        return "equipment-documents-route-patrol"
    if "/output-records" in p or "/output-dataset-binding" in p:
        return "equipment-documents-output-record"
    raise ValueError(f"HaoliGO equipment documents: unmapped path {path!r}")


def require_equipment_master_path_access(*, check_abac: bool = True):
    """按请求路径解析设备主数据 module + action。"""

    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        path = (request.url.path or "").lower()
        if "/workshops" in path and (request.method or "").upper() == "GET":
            await ensure_permission_codes(
                auth,
                tenant_id,
                request,
                _workshops_read_permission_codes(),
                require_all=False,
                check_abac=check_abac,
            )
            auth.tenant_id = tenant_id
            return auth

        try:
            mod = resolve_equipment_master_module(request.url.path)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
        action = resolve_haoligo_module_action(request.method, request.url.path)
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


def require_equipment_document_path_access(*, check_abac: bool = True):
    """按请求路径解析设备单据 module + action。"""

    async def dependency(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        tenant_id: int = Depends(get_current_tenant),
    ) -> AuthContext:
        try:
            mod = resolve_equipment_document_module(request.url.path)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
        action = resolve_haoligo_module_action(request.method, request.url.path)
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
