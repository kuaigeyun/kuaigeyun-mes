from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import List, Optional
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from apps.kuaizhizao.models.spare_part import SparePart, SparePartInventory, SparePartStockRecord
from apps.kuaizhizao.services.spare_part_service import SparePartService
from apps.kuaizhizao.schemas.equipment_extra import SparePartResponse

router = APIRouter(prefix="/spare-parts", tags=["App · Kuaige Zhizao · Spare Parts"])
service = SparePartService()

@router.get("", response_model=List[SparePartResponse])
async def list_spare_parts(
    tenant_id: int = Depends(get_current_tenant),
):
    """获取所有备件列表"""
    parts = await SparePart.filter(tenant_id=tenant_id, is_active=True).all()
    return [SparePartResponse.model_validate(p) for p in parts]

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
        part = await i.spare_part
        res.append({
            "id": i.id,
            "part_no": part.part_no,
            "part_name": part.part_name,
            "stock_quantity": i.stock_quantity,
            "warehouse_location": i.warehouse_location
        })
    return res
