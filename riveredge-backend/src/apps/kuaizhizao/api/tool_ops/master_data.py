"""
工装运营主数据 API：保养/维修项与方案。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.kuaizhizao.schemas.tool_ops import (
    ToolMaintenanceItemCreate,
    ToolMaintenanceItemUpdate,
    ToolMaintenanceItemResponse,
    ToolMaintenanceItemListResponse,
    ToolMaintenanceSchemeCreate,
    ToolMaintenanceSchemeUpdate,
    ToolMaintenanceSchemeResponse,
    ToolMaintenanceSchemeListResponse,
    ToolMaintenanceSchemeLineResponse,
    ToolRepairItemCreate,
    ToolRepairItemUpdate,
    ToolRepairItemResponse,
    ToolRepairItemListResponse,
    ToolRepairSchemeCreate,
    ToolRepairSchemeUpdate,
    ToolRepairSchemeResponse,
    ToolRepairSchemeListResponse,
    ToolRepairSchemeLineResponse,
)
from apps.kuaizhizao.services.tool_ops_service import ToolOpsService

router = APIRouter()
svc = ToolOpsService()


def _validation_http(e: ValidationError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _not_found_http(e: NotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


def _maint_scheme_response(scheme, lines) -> ToolMaintenanceSchemeResponse:
    resp = ToolMaintenanceSchemeResponse.model_validate(scheme)
    resp.lines = [ToolMaintenanceSchemeLineResponse.model_validate(l) for l in lines]
    return resp


def _repair_scheme_response(scheme, lines) -> ToolRepairSchemeResponse:
    resp = ToolRepairSchemeResponse.model_validate(scheme)
    resp.lines = [ToolRepairSchemeLineResponse.model_validate(l) for l in lines]
    return resp


# ---------- 保养项 ----------

@router.post(
    "/tool-maintenance-items",
    response_model=ToolMaintenanceItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-item:create"))],
)
async def create_tool_maintenance_item(
    data: ToolMaintenanceItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_item_service.create(tenant_id, data)
        return ToolMaintenanceItemResponse.model_validate(row)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/tool-maintenance-items",
    response_model=ToolMaintenanceItemListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-item:read"))],
)
async def list_tool_maintenance_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.maintenance_item_service._list(tenant_id, skip, limit, search, is_active)
    return ToolMaintenanceItemListResponse(
        items=[ToolMaintenanceItemResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-maintenance-items/{row_id}",
    response_model=ToolMaintenanceItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-item:read"))],
)
async def get_tool_maintenance_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.maintenance_item_service._get(tenant_id, row_id)
        return ToolMaintenanceItemResponse.model_validate(row)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/tool-maintenance-items/{row_id}",
    response_model=ToolMaintenanceItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-item:update"))],
)
async def update_tool_maintenance_item(
    row_id: int,
    data: ToolMaintenanceItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_item_service.update(tenant_id, row_id, data)
        return ToolMaintenanceItemResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/tool-maintenance-items/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-item:delete"))],
)
async def delete_tool_maintenance_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_item_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 保养方案 ----------

@router.post(
    "/tool-maintenance-schemes",
    response_model=ToolMaintenanceSchemeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:create"))],
)
async def create_tool_maintenance_scheme(
    data: ToolMaintenanceSchemeCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.maintenance_scheme_service.create(tenant_id, data)
        _, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _maint_scheme_response(scheme, lines)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/tool-maintenance-schemes",
    response_model=ToolMaintenanceSchemeListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:read"))],
)
async def list_tool_maintenance_schemes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.maintenance_scheme_service._list(tenant_id, skip, limit, search, is_active)
    return ToolMaintenanceSchemeListResponse(
        items=[ToolMaintenanceSchemeResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-maintenance-schemes/{row_id}",
    response_model=ToolMaintenanceSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:read"))],
)
async def get_tool_maintenance_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        scheme, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, row_id)
        return _maint_scheme_response(scheme, lines)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/tool-maintenance-schemes/{row_id}",
    response_model=ToolMaintenanceSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:update"))],
)
async def update_tool_maintenance_scheme(
    row_id: int,
    data: ToolMaintenanceSchemeUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.maintenance_scheme_service.update(tenant_id, row_id, data)
        _, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _maint_scheme_response(scheme, lines)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/tool-maintenance-schemes/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:delete"))],
)
async def delete_tool_maintenance_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_scheme_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 维修项 ----------

@router.post(
    "/tool-repair-items",
    response_model=ToolRepairItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-item:create"))],
)
async def create_tool_repair_item(
    data: ToolRepairItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_item_service.create(tenant_id, data)
        return ToolRepairItemResponse.model_validate(row)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/tool-repair-items",
    response_model=ToolRepairItemListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-item:read"))],
)
async def list_tool_repair_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.repair_item_service._list(tenant_id, skip, limit, search, is_active)
    return ToolRepairItemListResponse(
        items=[ToolRepairItemResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-repair-items/{row_id}",
    response_model=ToolRepairItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-item:read"))],
)
async def get_tool_repair_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.repair_item_service._get(tenant_id, row_id)
        return ToolRepairItemResponse.model_validate(row)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/tool-repair-items/{row_id}",
    response_model=ToolRepairItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-item:update"))],
)
async def update_tool_repair_item(
    row_id: int,
    data: ToolRepairItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_item_service.update(tenant_id, row_id, data)
        return ToolRepairItemResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/tool-repair-items/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-item:delete"))],
)
async def delete_tool_repair_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.repair_item_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 维修方案 ----------

@router.post(
    "/tool-repair-schemes",
    response_model=ToolRepairSchemeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-scheme:create"))],
)
async def create_tool_repair_scheme(
    data: ToolRepairSchemeCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.repair_scheme_service.create(tenant_id, data)
        _, lines = await svc.repair_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _repair_scheme_response(scheme, lines)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/tool-repair-schemes",
    response_model=ToolRepairSchemeListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-scheme:read"))],
)
async def list_tool_repair_schemes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.repair_scheme_service._list(tenant_id, skip, limit, search, is_active)
    return ToolRepairSchemeListResponse(
        items=[ToolRepairSchemeResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-repair-schemes/{row_id}",
    response_model=ToolRepairSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-scheme:read"))],
)
async def get_tool_repair_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        scheme, lines = await svc.repair_scheme_service.get_with_lines(tenant_id, row_id)
        return _repair_scheme_response(scheme, lines)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/tool-repair-schemes/{row_id}",
    response_model=ToolRepairSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-scheme:update"))],
)
async def update_tool_repair_scheme(
    row_id: int,
    data: ToolRepairSchemeUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.repair_scheme_service.update(tenant_id, row_id, data)
        _, lines = await svc.repair_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _repair_scheme_response(scheme, lines)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/tool-repair-schemes/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair-scheme:delete"))],
)
async def delete_tool_repair_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.repair_scheme_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)
