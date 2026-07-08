"""
模具运营主数据 API：保养/维修项与方案。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.kuaizhizao.schemas.mold_ops import (
    MoldMaintenanceItemCreate,
    MoldMaintenanceItemUpdate,
    MoldMaintenanceItemResponse,
    MoldMaintenanceItemListResponse,
    MoldMaintenanceSchemeCreate,
    MoldMaintenanceSchemeUpdate,
    MoldMaintenanceSchemeResponse,
    MoldMaintenanceSchemeListResponse,
    MoldMaintenanceSchemeLineResponse,
    MoldRepairItemCreate,
    MoldRepairItemUpdate,
    MoldRepairItemResponse,
    MoldRepairItemListResponse,
    MoldRepairSchemeCreate,
    MoldRepairSchemeUpdate,
    MoldRepairSchemeResponse,
    MoldRepairSchemeListResponse,
    MoldRepairSchemeLineResponse,
)
from apps.kuaizhizao.services.mold_ops_service import MoldOpsService

router = APIRouter()
svc = MoldOpsService()


def _validation_http(e: ValidationError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _not_found_http(e: NotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


def _maint_scheme_response(scheme, lines) -> MoldMaintenanceSchemeResponse:
    resp = MoldMaintenanceSchemeResponse.model_validate(scheme)
    resp.lines = [MoldMaintenanceSchemeLineResponse.model_validate(l) for l in lines]
    return resp


def _repair_scheme_response(scheme, lines) -> MoldRepairSchemeResponse:
    resp = MoldRepairSchemeResponse.model_validate(scheme)
    resp.lines = [MoldRepairSchemeLineResponse.model_validate(l) for l in lines]
    return resp


# ---------- 保养项 ----------

@router.post(
    "/mold-maintenance-items",
    response_model=MoldMaintenanceItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-item:create"))],
)
async def create_mold_maintenance_item(
    data: MoldMaintenanceItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_item_service.create(tenant_id, data)
        return MoldMaintenanceItemResponse.model_validate(row)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/mold-maintenance-items",
    response_model=MoldMaintenanceItemListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-item:read"))],
)
async def list_mold_maintenance_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.maintenance_item_service._list(tenant_id, skip, limit, search, is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return MoldMaintenanceItemListResponse(
        items=[MoldMaintenanceItemResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-maintenance-items/{row_id}",
    response_model=MoldMaintenanceItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-item:read"))],
)
async def get_mold_maintenance_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.maintenance_item_service._get(tenant_id, row_id)
        return MoldMaintenanceItemResponse.model_validate(row)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/mold-maintenance-items/{row_id}",
    response_model=MoldMaintenanceItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-item:update"))],
)
async def update_mold_maintenance_item(
    row_id: int,
    data: MoldMaintenanceItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_item_service.update(tenant_id, row_id, data)
        return MoldMaintenanceItemResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/mold-maintenance-items/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-item:delete"))],
)
async def delete_mold_maintenance_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_item_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 保养方案 ----------

@router.post(
    "/mold-maintenance-schemes",
    response_model=MoldMaintenanceSchemeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:create"))],
)
async def create_mold_maintenance_scheme(
    data: MoldMaintenanceSchemeCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.maintenance_scheme_service.create(tenant_id, data)
        _, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _maint_scheme_response(scheme, lines)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/mold-maintenance-schemes",
    response_model=MoldMaintenanceSchemeListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:read"))],
)
async def list_mold_maintenance_schemes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.maintenance_scheme_service._list(tenant_id, skip, limit, search, is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return MoldMaintenanceSchemeListResponse(
        items=[MoldMaintenanceSchemeResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-maintenance-schemes/{row_id}",
    response_model=MoldMaintenanceSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:read"))],
)
async def get_mold_maintenance_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        scheme, lines = await svc.maintenance_scheme_service.get_with_lines(tenant_id, row_id)
        return _maint_scheme_response(scheme, lines)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/mold-maintenance-schemes/{row_id}",
    response_model=MoldMaintenanceSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:update"))],
)
async def update_mold_maintenance_scheme(
    row_id: int,
    data: MoldMaintenanceSchemeUpdate,
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
    "/mold-maintenance-schemes/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:delete"))],
)
async def delete_mold_maintenance_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_scheme_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 维修项 ----------

@router.post(
    "/mold-repair-items",
    response_model=MoldRepairItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-item:create"))],
)
async def create_mold_repair_item(
    data: MoldRepairItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_item_service.create(tenant_id, data)
        return MoldRepairItemResponse.model_validate(row)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/mold-repair-items",
    response_model=MoldRepairItemListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-item:read"))],
)
async def list_mold_repair_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.repair_item_service._list(tenant_id, skip, limit, search, is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return MoldRepairItemListResponse(
        items=[MoldRepairItemResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-repair-items/{row_id}",
    response_model=MoldRepairItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-item:read"))],
)
async def get_mold_repair_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.repair_item_service._get(tenant_id, row_id)
        return MoldRepairItemResponse.model_validate(row)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/mold-repair-items/{row_id}",
    response_model=MoldRepairItemResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-item:update"))],
)
async def update_mold_repair_item(
    row_id: int,
    data: MoldRepairItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_item_service.update(tenant_id, row_id, data)
        return MoldRepairItemResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        if isinstance(e, NotFoundError):
            raise _not_found_http(e)
        raise _validation_http(e)


@router.delete(
    "/mold-repair-items/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-item:delete"))],
)
async def delete_mold_repair_item(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.repair_item_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)


# ---------- 维修方案 ----------

@router.post(
    "/mold-repair-schemes",
    response_model=MoldRepairSchemeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-scheme:create"))],
)
async def create_mold_repair_scheme(
    data: MoldRepairSchemeCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        scheme = await svc.repair_scheme_service.create(tenant_id, data)
        _, lines = await svc.repair_scheme_service.get_with_lines(tenant_id, scheme.id)
        return _repair_scheme_response(scheme, lines)
    except ValidationError as e:
        raise _validation_http(e)


@router.get(
    "/mold-repair-schemes",
    response_model=MoldRepairSchemeListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-scheme:read"))],
)
async def list_mold_repair_schemes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.repair_scheme_service._list(tenant_id, skip, limit, search, is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return MoldRepairSchemeListResponse(
        items=[MoldRepairSchemeResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-repair-schemes/{row_id}",
    response_model=MoldRepairSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-scheme:read"))],
)
async def get_mold_repair_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        scheme, lines = await svc.repair_scheme_service.get_with_lines(tenant_id, row_id)
        return _repair_scheme_response(scheme, lines)
    except NotFoundError as e:
        raise _not_found_http(e)


@router.put(
    "/mold-repair-schemes/{row_id}",
    response_model=MoldRepairSchemeResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-scheme:update"))],
)
async def update_mold_repair_scheme(
    row_id: int,
    data: MoldRepairSchemeUpdate,
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
    "/mold-repair-schemes/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair-scheme:delete"))],
)
async def delete_mold_repair_scheme(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.repair_scheme_service._soft_delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _not_found_http(e)
