"""
设备故障维修管理 API 路由

提供设备故障和维修记录的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.models.equipment_fault import EquipmentFault, EquipmentRepair
from apps.kuaizhizao.schemas.equipment_fault import (
    EquipmentFaultCreate,
    EquipmentFaultUpdate,
    EquipmentFaultResponse,
    EquipmentFaultListResponse,
    EquipmentRepairCreate,
    EquipmentRepairUpdate,
    EquipmentRepairResponse,
    EquipmentRepairListResponse,
)
from apps.kuaizhizao.services.equipment_fault_service import EquipmentFaultService, EquipmentRepairService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/equipment-faults", tags=["Kuaige Zhizao Equipment Faults"])


# ========== 设备故障记录相关端点 ==========

@router.post("", response_model=EquipmentFaultResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment_fault(
    data: EquipmentFaultCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建设备故障记录
    
    创建新设备故障记录并保存到数据库。
    """
    try:
        fault = await EquipmentFaultService.create_equipment_fault(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return EquipmentFaultResponse.model_validate(fault)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=EquipmentFaultListResponse)
async def list_equipment_faults(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    equipment_uuid: Optional[str] = Query(None, description="设备UUID（可选）"),
    status: Optional[str] = Query(None, description="故障状态（可选）"),
    fault_type: Optional[str] = Query(None, description="故障类型（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备故障记录列表
    
    获取当前组织的设备故障记录列表，支持筛选和搜索。
    """
    faults, total = await EquipmentFaultService.list_equipment_faults(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        equipment_uuid=equipment_uuid,
        status=status,
        fault_type=fault_type,
        search=search
    )
    
    items = [EquipmentFaultResponse.model_validate(fault) for fault in faults]
    
    return EquipmentFaultListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{uuid}", response_model=EquipmentFaultResponse)
async def get_equipment_fault(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备故障记录详情
    
    根据UUID获取设备故障记录详情。
    """
    try:
        fault = await EquipmentFaultService.get_equipment_fault_by_uuid(tenant_id, uuid)
        return EquipmentFaultResponse.model_validate(fault)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=EquipmentFaultResponse)
async def update_equipment_fault(
    uuid: str,
    data: EquipmentFaultUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新设备故障记录
    
    更新设备故障记录信息。
    """
    try:
        fault = await EquipmentFaultService.update_equipment_fault(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return EquipmentFaultResponse.model_validate(fault)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment_fault(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除设备故障记录
    
    软删除设备故障记录（标记为已删除，不实际删除数据）。
    """
    try:
        await EquipmentFaultService.delete_equipment_fault(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# ========== 设备维修记录相关端点 ==========

@router.post("/repairs", response_model=EquipmentRepairResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment_repair(
    data: EquipmentRepairCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建设备维修记录
    
    创建新设备维修记录并保存到数据库。
    """
    try:
        repair = await EquipmentRepairService.create_equipment_repair(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return EquipmentRepairResponse.model_validate(repair)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("/repairs", response_model=EquipmentRepairListResponse)
async def list_equipment_repairs(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    equipment_uuid: Optional[str] = Query(None, description="设备UUID（可选）"),
    equipment_fault_uuid: Optional[str] = Query(None, description="设备故障UUID（可选）"),
    status: Optional[str] = Query(None, description="维修状态（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备维修记录列表
    
    获取当前组织的设备维修记录列表，支持筛选和搜索。
    """
    repairs, total = await EquipmentRepairService.list_equipment_repairs(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        equipment_uuid=equipment_uuid,
        equipment_fault_uuid=equipment_fault_uuid,
        status=status,
        search=search
    )
    
    items = [EquipmentRepairResponse.model_validate(repair) for repair in repairs]
    
    return EquipmentRepairListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/repairs/{uuid}", response_model=EquipmentRepairResponse)
async def get_equipment_repair(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备维修记录详情
    
    根据UUID获取设备维修记录详情。
    """
    try:
        repair = await EquipmentRepairService.get_equipment_repair_by_uuid(tenant_id, uuid)
        return EquipmentRepairResponse.model_validate(repair)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/repairs/{uuid}", response_model=EquipmentRepairResponse)
async def update_equipment_repair(
    uuid: str,
    data: EquipmentRepairUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新设备维修记录
    
    更新设备维修记录信息。
    """
    try:
        repair = await EquipmentRepairService.update_equipment_repair(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return EquipmentRepairResponse.model_validate(repair)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/repairs/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment_repair(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除设备维修记录
    
    软删除设备维修记录（标记为已删除，不实际删除数据）。
    """
    try:
        await EquipmentRepairService.delete_equipment_repair(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

