"""
设备运营主数据 API：点检项/方案、巡检路线、保养项/方案。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.equipment_ops import (
    InspectionItemCreate,
    InspectionItemUpdate,
    InspectionItemResponse,
    InspectionItemListResponse,
    InspectionSchemeCreate,
    InspectionSchemeUpdate,
    InspectionSchemeResponse,
    InspectionSchemeListResponse,
    InspectionSchemeLineResponse,
    PatrolRouteCreate,
    PatrolRouteUpdate,
    PatrolRouteResponse,
    PatrolRouteListResponse,
    PatrolRouteStepResponse,
    MaintenanceItemCreate,
    MaintenanceItemUpdate,
    MaintenanceItemResponse,
    MaintenanceItemListResponse,
    MaintenanceSchemeCreate,
    MaintenanceSchemeUpdate,
    MaintenanceSchemeResponse,
    MaintenanceSchemeListResponse,
    MaintenanceSchemeLineResponse,
)
from apps.kuaizhizao.services.equipment_ops_service import EquipmentOpsService

router = APIRouter()
svc = EquipmentOpsService()


def _validation_http(e: ValidationError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _not_found_http(e: NotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


def _scheme_response(scheme, lines) -> InspectionSchemeResponse:
    resp = InspectionSchemeResponse.model_validate(scheme)
    resp.lines = [InspectionSchemeLineResponse.model_validate(l) for l in lines]
    return resp


def _route_response(route, steps) -> PatrolRouteResponse:
    resp = PatrolRouteResponse.model_validate(route)
    resp.steps = [PatrolRouteStepResponse.model_validate(s) for s in steps]
    return resp


def _maint_scheme_response(scheme, lines) -> MaintenanceSchemeResponse:
    resp = MaintenanceSchemeResponse.model_validate(scheme)
    resp.lines = [MaintenanceSchemeLineResponse.model_validate(l) for l in lines]
    return resp


# ---------- 点检项 ----------

@router.post(
    "/equipment-inspection-items",
    response_model=InspectionItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-item:create"))],
)
async def create_inspection_item(
    data: InspectionItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.inspection_item_service.create(tenant_id, data)
        return InspectionItemResponse.model_validate(row)
    except ValidationError as e:
        raise _validation_http(e)


@router.get("/equipment-inspection-items", response_model=InspectionItemListResponse)
async def list_inspection_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.inspection_item_service._list(tenant_id, skip, limit, search, is_active)
    return InspectionItemListResponse(
        items=[InspectionItemResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/equipment-inspection-items/{row_id}", response_model=InspectionItemResponse)
async def get_inspection_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.inspection_item_service._get(tenant_id, row_id)
        return InspectionItemResponse.model_validate(row)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/equipment-inspection-items/{row_id}",
    response_model=InspectionItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-item:update"))],
)
async def update_inspection_item(
    row_id: int,
    data: InspectionItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.inspection_item_service.update(tenant_id, row_id, data)
        return InspectionItemResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/equipment-inspection-items/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-item:delete"))],
)
async def delete_inspection_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.inspection_item_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 点检方案 ----------

@router.post(
    "/equipment-inspection-schemes",
    response_model=InspectionSchemeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-scheme:create"))],
)
async def create_inspection_scheme(
    data: InspectionSchemeCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.inspection_scheme_service.create(tenant_id, data)
        _, lines = await svc.inspection_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _scheme_response(scheme, lines)
    except ValidationError as e:
        raise _validation_http(e)


@router.get("/equipment-inspection-schemes", response_model=InspectionSchemeListResponse)
async def list_inspection_schemes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.inspection_scheme_service._list(tenant_id, skip, limit, search, is_active)
    items = []
    for row in rows:
        _, lines = await svc.inspection_scheme_service.get_with_lines(tenant_id, row.id)
        items.append(_scheme_response(row, lines))
    return InspectionSchemeListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/equipment-inspection-schemes/{row_id}", response_model=InspectionSchemeResponse)
async def get_inspection_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        scheme, lines = await svc.inspection_scheme_service.get_with_lines(tenant_id, row_id)
        return _scheme_response(scheme, lines)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/equipment-inspection-schemes/{row_id}",
    response_model=InspectionSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-scheme:update"))],
)
async def update_inspection_scheme(
    row_id: int,
    data: InspectionSchemeUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.inspection_scheme_service.update(tenant_id, row_id, data)
        _, lines = await svc.inspection_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _scheme_response(scheme, lines)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/equipment-inspection-schemes/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-scheme:delete"))],
)
async def delete_inspection_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.inspection_scheme_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 巡检路线 ----------

@router.post(
    "/equipment-patrol-routes",
    response_model=PatrolRouteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-patrol-route:create"))],
)
async def create_patrol_route(
    data: PatrolRouteCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        route = await svc.patrol_route_service.create(tenant_id, data)
        _, steps = await svc.patrol_route_service.get_with_steps(tenant_id, route.id)
        return _route_response(route, steps)
    except ValidationError as e:
        raise _validation_http(e)


@router.get("/equipment-patrol-routes", response_model=PatrolRouteListResponse)
async def list_patrol_routes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.patrol_route_service._list(tenant_id, skip, limit, search, is_active)
    items = []
    for row in rows:
        _, steps = await svc.patrol_route_service.get_with_steps(tenant_id, row.id)
        items.append(_route_response(row, steps))
    return PatrolRouteListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/equipment-patrol-routes/{row_id}", response_model=PatrolRouteResponse)
async def get_patrol_route(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        route, steps = await svc.patrol_route_service.get_with_steps(tenant_id, row_id)
        return _route_response(route, steps)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/equipment-patrol-routes/{row_id}",
    response_model=PatrolRouteResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-patrol-route:update"))],
)
async def update_patrol_route(
    row_id: int,
    data: PatrolRouteUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        route = await svc.patrol_route_service.update(tenant_id, row_id, data)
        _, steps = await svc.patrol_route_service.get_with_steps(tenant_id, route.id)
        return _route_response(route, steps)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/equipment-patrol-routes/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-patrol-route:delete"))],
)
async def delete_patrol_route(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.patrol_route_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 保养项 ----------

@router.post(
    "/equipment-maintenance-items",
    response_model=MaintenanceItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-maintenance-item:create"))],
)
async def create_maintenance_item(
    data: MaintenanceItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_item_service.create(tenant_id, data)
        return MaintenanceItemResponse.model_validate(row)
    except ValidationError as e:
        raise _validation_http(e)


@router.get("/equipment-maintenance-items", response_model=MaintenanceItemListResponse)
async def list_maintenance_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.maintenance_item_service._list(tenant_id, skip, limit, search, is_active)
    return MaintenanceItemListResponse(
        items=[MaintenanceItemResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/equipment-maintenance-items/{row_id}", response_model=MaintenanceItemResponse)
async def get_maintenance_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.maintenance_item_service._get(tenant_id, row_id)
        return MaintenanceItemResponse.model_validate(row)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/equipment-maintenance-items/{row_id}",
    response_model=MaintenanceItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-maintenance-item:update"))],
)
async def update_maintenance_item(
    row_id: int,
    data: MaintenanceItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_item_service.update(tenant_id, row_id, data)
        return MaintenanceItemResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/equipment-maintenance-items/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-maintenance-item:delete"))],
)
async def delete_maintenance_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_item_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 保养方案 ----------

@router.post(
    "/equipment-maintenance-schemes",
    response_model=MaintenanceSchemeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-maintenance-scheme:create"))],
)
async def create_maintenance_scheme(
    data: MaintenanceSchemeCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.maintenance_scheme_service.create(tenant_id, data)
        _, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _maint_scheme_response(scheme, lines)
    except ValidationError as e:
        raise _validation_http(e)


@router.get("/equipment-maintenance-schemes", response_model=MaintenanceSchemeListResponse)
async def list_maintenance_schemes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.maintenance_scheme_service._list(tenant_id, skip, limit, search, is_active)
    items = []
    for row in rows:
        _, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, row.id)
        items.append(_maint_scheme_response(row, lines))
    return MaintenanceSchemeListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/equipment-maintenance-schemes/{row_id}", response_model=MaintenanceSchemeResponse)
async def get_maintenance_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        scheme, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, row_id)
        return _maint_scheme_response(scheme, lines)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/equipment-maintenance-schemes/{row_id}",
    response_model=MaintenanceSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-maintenance-scheme:update"))],
)
async def update_maintenance_scheme(
    row_id: int,
    data: MaintenanceSchemeUpdate,
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
    "/equipment-maintenance-schemes/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-maintenance-scheme:delete"))],
)
async def delete_maintenance_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_scheme_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)
