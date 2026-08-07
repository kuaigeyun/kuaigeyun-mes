"""物流主数据 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.logistics import (
    DriverCreate,
    DriverUpdate,
    LogisticsCarrierCreate,
    LogisticsCarrierUpdate,
    PaginatedCarrierList,
    PaginatedDriverList,
    PaginatedVehicleList,
    VehicleCreate,
    VehicleUpdate,
)
from apps.kuaizhizao.services.logistics_master_service import LogisticsMasterService
from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

service = LogisticsMasterService()

carriers_router = APIRouter(
    prefix="/logistics/carriers",
    tags=["App - Kuaige Zhizao - Logistics Carrier"],
    dependencies=[Depends(require_kuaizhizao_module_access("logistics-carrier"))],
)
vehicles_router = APIRouter(
    prefix="/logistics/vehicles",
    tags=["App - Kuaige Zhizao - Vehicle"],
    dependencies=[Depends(require_kuaizhizao_module_access("vehicle"))],
)
drivers_router = APIRouter(
    prefix="/logistics/drivers",
    tags=["App - Kuaige Zhizao - Driver"],
    dependencies=[Depends(require_kuaizhizao_module_access("driver"))],
)


@carriers_router.get("", response_model=PaginatedCarrierList)
async def list_carriers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_carriers(tenant_id, skip=skip, limit=limit, keyword=keyword)


@carriers_router.post("", summary="Create carrier")
async def create_carrier(
    data: LogisticsCarrierCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.create_carrier(tenant_id, data)
        return row
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@carriers_router.put("/{record_id}")
async def update_carrier(
    data: LogisticsCarrierUpdate,
    record_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_carrier(tenant_id, record_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@carriers_router.delete("/{record_id}")
async def delete_carrier(
    record_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_carrier(tenant_id, record_id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@vehicles_router.get("", response_model=PaginatedVehicleList)
async def list_vehicles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    ownership: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_vehicles(tenant_id, skip=skip, limit=limit, keyword=keyword, ownership=ownership)


@vehicles_router.post("")
async def create_vehicle(data: VehicleCreate, tenant_id: int = Depends(get_current_tenant)):
    try:
        return await service.create_vehicle(tenant_id, data)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@vehicles_router.put("/{record_id}")
async def update_vehicle(
    data: VehicleUpdate,
    record_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_vehicle(tenant_id, record_id, data)
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@vehicles_router.delete("/{record_id}")
async def delete_vehicle(record_id: int = Path(...), tenant_id: int = Depends(get_current_tenant)):
    try:
        await service.delete_vehicle(tenant_id, record_id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@drivers_router.get("", response_model=PaginatedDriverList)
async def list_drivers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    ownership: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_drivers(tenant_id, skip=skip, limit=limit, keyword=keyword, ownership=ownership)


@drivers_router.post("")
async def create_driver(data: DriverCreate, tenant_id: int = Depends(get_current_tenant)):
    try:
        return await service.create_driver(tenant_id, data)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@drivers_router.put("/{record_id}")
async def update_driver(
    data: DriverUpdate,
    record_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_driver(tenant_id, record_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@drivers_router.delete("/{record_id}")
async def delete_driver(record_id: int = Path(...), tenant_id: int = Depends(get_current_tenant)):
    try:
        await service.delete_driver(tenant_id, record_id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
