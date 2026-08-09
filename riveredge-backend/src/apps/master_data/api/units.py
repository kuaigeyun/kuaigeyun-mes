"""物料单位与换算关系 API。"""

from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status
from loguru import logger

from apps.master_data.api._master_data_route_access import require_master_data_module_access
from apps.master_data.schemas.unit_schemas import (
    MaterialUnitConversionCreate,
    MaterialUnitConversionListResponse,
    MaterialUnitConversionResolveResponse,
    MaterialUnitConversionResponse,
    MaterialUnitConversionUpdate,
    MaterialUnitCreate,
    MaterialUnitEnsurePresetsResponse,
    MaterialUnitListResponse,
    MaterialUnitResponse,
    MaterialUnitUpdate,
)
from apps.master_data.services.unit_service import MaterialUnitConversionService, MaterialUnitService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

# 下拉/展示：物料编辑或单位管理均可读；CRUD 仍走 material-unit
_UNIT_CATALOG_READ = Depends(
    require_permission_codes(
        "master-data:material-unit:read",
        "master-data:material:read",
        require_all=False,
    )
)
_UNIT_MANAGE = Depends(require_master_data_module_access("material-unit"))

router = APIRouter(
    prefix="/materials",
    tags=["App - Master Data - Units"],
)


def _http(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_units_api_error trace_id={} status_code={} message={}",
        trace_id,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.post(
    "/units/ensure-presets",
    response_model=MaterialUnitEnsurePresetsResponse,
    summary="Ensure unit presets and backfill",
    dependencies=[_UNIT_MANAGE],
)
async def ensure_unit_presets(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await MaterialUnitService.ensure_presets_and_backfill(tenant_id, user=current_user)
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.get(
    "/units",
    response_model=MaterialUnitListResponse,
    summary="List material units",
    dependencies=[_UNIT_CATALOG_READ],
)
async def list_units(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
):
    items, total = await MaterialUnitService.list_units(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return MaterialUnitListResponse(
        items=[MaterialUnitResponse.model_validate(i) for i in items],
        total=total,
    )


@router.post(
    "/units",
    response_model=MaterialUnitResponse,
    summary="Create material unit",
    dependencies=[_UNIT_MANAGE],
)
async def create_unit(
    data: MaterialUnitCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        row = await MaterialUnitService.create_unit(
            tenant_id, data.model_dump(), user=current_user
        )
        return MaterialUnitResponse.model_validate(row)
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.get(
    "/units/{unit_uuid}",
    response_model=MaterialUnitResponse,
    summary="Get material unit",
    dependencies=[_UNIT_CATALOG_READ],
)
async def get_unit(
    unit_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        row = await MaterialUnitService.get_by_uuid(tenant_id, unit_uuid)
        return MaterialUnitResponse.model_validate(row)
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))


@router.put(
    "/units/{unit_uuid}",
    response_model=MaterialUnitResponse,
    summary="Update material unit",
    dependencies=[_UNIT_MANAGE],
)
async def update_unit(
    unit_uuid: str,
    data: MaterialUnitUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        row = await MaterialUnitService.update_unit(
            tenant_id, unit_uuid, data.model_dump(exclude_unset=True), user=current_user
        )
        return MaterialUnitResponse.model_validate(row)
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.delete(
    "/units/{unit_uuid}",
    summary="Delete material unit",
    dependencies=[_UNIT_MANAGE],
)
async def delete_unit(
    unit_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await MaterialUnitService.delete_unit(tenant_id, unit_uuid, user=current_user)
        return {"success": True}
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.get(
    "/unit-conversions/resolve",
    response_model=MaterialUnitConversionResolveResponse,
    summary="Resolve conversion for material multi-unit row",
    dependencies=[_UNIT_CATALOG_READ],
)
async def resolve_conversion(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    base_unit: str = Query(..., alias="baseUnit"),
    aux_unit: str = Query(..., alias="auxUnit"),
):
    return await MaterialUnitConversionService.resolve_for_material(
        tenant_id, base_unit=base_unit, aux_unit=aux_unit
    )


@router.get(
    "/unit-conversions",
    response_model=MaterialUnitConversionListResponse,
    summary="List unit conversions",
    dependencies=[_UNIT_MANAGE],
)
async def list_conversions(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    items, total = await MaterialUnitConversionService.list_conversions(
        tenant_id, skip=skip, limit=limit, keyword=keyword, is_active=is_active
    )
    return MaterialUnitConversionListResponse(
        items=[MaterialUnitConversionResponse.model_validate(i) for i in items],
        total=total,
    )


@router.post(
    "/unit-conversions",
    response_model=MaterialUnitConversionResponse,
    summary="Create unit conversion",
    dependencies=[_UNIT_MANAGE],
)
async def create_conversion(
    data: MaterialUnitConversionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        row = await MaterialUnitConversionService.create_conversion(
            tenant_id, data.model_dump(), user=current_user
        )
        return MaterialUnitConversionResponse.model_validate(row)
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.put(
    "/unit-conversions/{conv_uuid}",
    response_model=MaterialUnitConversionResponse,
    summary="Update unit conversion",
    dependencies=[_UNIT_MANAGE],
)
async def update_conversion(
    conv_uuid: str,
    data: MaterialUnitConversionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        row = await MaterialUnitConversionService.update_conversion(
            tenant_id, conv_uuid, data.model_dump(exclude_unset=True), user=current_user
        )
        return MaterialUnitConversionResponse.model_validate(row)
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.delete(
    "/unit-conversions/{conv_uuid}",
    summary="Delete unit conversion",
    dependencies=[_UNIT_MANAGE],
)
async def delete_conversion(
    conv_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await MaterialUnitConversionService.delete_conversion(
            tenant_id, conv_uuid, user=current_user
        )
        return {"success": True}
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))
