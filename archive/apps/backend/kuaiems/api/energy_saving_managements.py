"""
节能管理 API 模块

提供节能管理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiems.services.energy_saving_management_service import EnergySavingManagementService
from apps.kuaiems.schemas.energy_saving_management_schemas import (
    EnergySavingManagementCreate, EnergySavingManagementUpdate, EnergySavingManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/energy-saving-managements", tags=["EnergySavingManagements"])


@router.post("", response_model=EnergySavingManagementResponse, status_code=status.HTTP_201_CREATED, summary="创建节能管理")
async def create_energy_saving_management(
    data: EnergySavingManagementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建节能管理"""
    try:
        return await EnergySavingManagementService.create_energy_saving_management(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EnergySavingManagementResponse], summary="获取节能管理列表")
async def list_energy_saving_managements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    management_type: Optional[str] = Query(None, description="管理类型（过滤）"),
    energy_type: Optional[str] = Query(None, description="能源类型（过滤）"),
    measure_status: Optional[str] = Query(None, description="措施状态（过滤）")
):
    """获取节能管理列表"""
    return await EnergySavingManagementService.list_energy_saving_managements(tenant_id, skip, limit, management_type, energy_type, measure_status)


@router.get("/{management_uuid}", response_model=EnergySavingManagementResponse, summary="获取节能管理详情")
async def get_energy_saving_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取节能管理详情"""
    try:
        return await EnergySavingManagementService.get_energy_saving_management_by_uuid(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{management_uuid}", response_model=EnergySavingManagementResponse, summary="更新节能管理")
async def update_energy_saving_management(
    management_uuid: str,
    data: EnergySavingManagementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新节能管理"""
    try:
        return await EnergySavingManagementService.update_energy_saving_management(tenant_id, management_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{management_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除节能管理")
async def delete_energy_saving_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除节能管理"""
    try:
        await EnergySavingManagementService.delete_energy_saving_management(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

