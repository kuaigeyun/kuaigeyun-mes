"""
设备管理 API 路由

提供设备的 CRUD 操作。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.models.equipment import Equipment
from core.schemas.equipment import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentResponse,
    EquipmentListResponse,
)
from core.services.equipment_service import EquipmentService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/equipment", tags=["Core Equipment"])


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    data: EquipmentCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建设备
    
    创建新设备并保存到数据库。
    
    Args:
        data: 设备创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentResponse: 创建的设备对象
        
    Raises:
        HTTPException: 当设备编码已存在或数据验证失败时抛出
    """
    try:
        equipment = await EquipmentService.create_equipment(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return EquipmentResponse.model_validate(equipment)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=EquipmentListResponse)
async def list_equipment(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="设备类型（可选）"),
    category: Optional[str] = Query(None, description="设备分类（可选）"),
    status: Optional[str] = Query(None, description="设备状态（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    workstation_id: Optional[int] = Query(None, description="工位ID（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选，搜索编码、名称）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备列表
    
    获取当前组织的设备列表，支持筛选和搜索。
    
    Args:
        skip: 跳过数量
        limit: 限制数量
        type: 设备类型（可选）
        category: 设备分类（可选）
        status: 设备状态（可选）
        is_active: 是否启用（可选）
        workstation_id: 工位ID（可选）
        search: 搜索关键词（可选，搜索编码、名称）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentListResponse: 设备列表响应
    """
    equipment_list, total = await EquipmentService.list_equipment(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        category=category,
        status=status,
        is_active=is_active,
        workstation_id=workstation_id,
        search=search
    )
    
    items = [EquipmentResponse.model_validate(eq) for eq in equipment_list]
    
    return EquipmentListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{uuid}", response_model=EquipmentResponse)
async def get_equipment(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备详情
    
    根据UUID获取设备详情。
    
    Args:
        uuid: 设备UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentResponse: 设备详情
        
    Raises:
        HTTPException: 当设备不存在时抛出
    """
    try:
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        return EquipmentResponse.model_validate(equipment)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=EquipmentResponse)
async def update_equipment(
    uuid: str,
    data: EquipmentUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新设备
    
    更新设备信息。
    
    Args:
        uuid: 设备UUID
        data: 设备更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentResponse: 更新后的设备对象
        
    Raises:
        HTTPException: 当设备不存在或数据验证失败时抛出
    """
    try:
        equipment = await EquipmentService.update_equipment(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return EquipmentResponse.model_validate(equipment)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除设备
    
    软删除设备（标记为已删除，不实际删除数据）。
    
    Args:
        uuid: 设备UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当设备不存在时抛出
    """
    try:
        await EquipmentService.delete_equipment(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

