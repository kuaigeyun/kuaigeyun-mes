from fastapi import APIRouter, Depends, Query, status
from typing import List, Optional
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from apps.kuaizhizao.services.equipment_point_inspection_service import EquipmentPointInspectionService
from apps.kuaizhizao.schemas.equipment_extra import PointInspectionRecordCreate, PointInspectionRecordResponse

router = APIRouter(prefix="/equipment-inspections", tags=["App · Kuaige Zhizao · Equipment Inspection"])
service = EquipmentPointInspectionService()

@router.post("", response_model=PointInspectionRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_inspection(
    data: PointInspectionRecordCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建点检记录"""
    record_data = data.model_dump()
    if not record_data.get("inspector_id"):
        record_data["inspector_id"] = current_user.id
    if not record_data.get("inspector_name"):
        record_data["inspector_name"] = current_user.nickname or current_user.username
    
    record = await service.create_inspection_record(tenant_id, record_data)
    return PointInspectionRecordResponse.model_validate(record)

@router.get("/history/{equipment_id}", response_model=List[PointInspectionRecordResponse])
async def get_history(
    equipment_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    """获取设备点检历史"""
    history = await service.get_equipment_inspection_history(tenant_id, equipment_id)
    return [PointInspectionRecordResponse.model_validate(r) for r in history]
