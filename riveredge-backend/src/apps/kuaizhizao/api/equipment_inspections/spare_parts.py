from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import List, Optional

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from apps.kuaizhizao.models.spare_part import SparePart, SparePartInventory
from apps.kuaizhizao.services.spare_part_service import SparePartService
from apps.kuaizhizao.schemas.equipment_extra import (
    SparePartResponse,
    SparePartCreate,
    SparePartUpdate,
    SparePartListResponse,
    SparePartStockAdjustRequest,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/spare-parts", tags=["App · Kuaige Zhizao · Spare Parts"])
service = SparePartService()


@router.get("/alerts", response_model=List[dict])
async def get_alerts(
    tenant_id: int = Depends(get_current_tenant),
):
    """获取低库存预警"""
    return await service.get_safety_stock_alerts(tenant_id)


@router.get("/inventory", response_model=List[dict])
async def list_inventory(
    tenant_id: int = Depends(get_current_tenant),
):
    """获取全库位库存"""
    inv = await SparePartInventory.filter(tenant_id=tenant_id).all()
    res = []
    for i in inv:
        part = await SparePart.filter(id=i.spare_part_id, tenant_id=tenant_id).first()
        if not part:
            continue
        res.append({
            "id": i.id,
            "part_no": part.part_no,
            "part_name": part.part_name,
            "stock_quantity": i.stock_quantity,
            "warehouse_location": i.warehouse_location
        })
    return res


@router.post(
    "/stock-adjust",
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part:update"))],
)
async def stock_adjust(
    body: SparePartStockAdjustRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        inventory = await service.adjust_stock(
            tenant_id=tenant_id,
            spare_part_id=body.spare_part_id,
            quantity=body.quantity,
            operation_type=body.operation_type,
            warehouse_location=body.warehouse_location,
            rel_type=body.rel_type,
            rel_id=body.rel_id,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
            remark=body.remark,
        )
        return {
            "id": inventory.id,
            "spare_part_id": inventory.spare_part_id,
            "warehouse_location": inventory.warehouse_location,
            "stock_quantity": inventory.stock_quantity,
        }
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.get("", response_model=SparePartListResponse)
async def list_spare_parts(
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
    """获取备件列表"""
    rows, total = await service.list_spare_parts(
        tenant_id,
        skip,
        limit,
        search,
        is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return SparePartListResponse(
        items=[SparePartResponse.model_validate(p) for p in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post(
    "",
    response_model=SparePartResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part:create"))],
)
async def create_spare_part(
    data: SparePartCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        part = await service.create_spare_part(tenant_id, data)
        return SparePartResponse.model_validate(part)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/{spare_part_id}", response_model=SparePartResponse)
async def get_spare_part(spare_part_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        part = await service.get_spare_part(tenant_id, spare_part_id)
        return SparePartResponse.model_validate(part)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/{spare_part_id}",
    response_model=SparePartResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part:update"))],
)
async def update_spare_part(
    spare_part_id: int,
    data: SparePartUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        part = await service.update_spare_part(tenant_id, spare_part_id, data)
        return SparePartResponse.model_validate(part)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/{spare_part_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part:delete"))],
)
async def delete_spare_part(spare_part_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await service.delete_spare_part(tenant_id, spare_part_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
