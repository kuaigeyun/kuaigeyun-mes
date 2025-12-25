"""
车辆调度 API 模块

提供车辆调度的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaitms.services.vehicle_dispatch_service import VehicleDispatchService
from apps.kuaitms.schemas.vehicle_dispatch_schemas import (
    VehicleDispatchCreate, VehicleDispatchUpdate, VehicleDispatchResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/vehicle-dispatches", tags=["VehicleDispatches"])


@router.post("", response_model=VehicleDispatchResponse, status_code=status.HTTP_201_CREATED, summary="创建车辆调度")
async def create_vehicle_dispatch(
    data: VehicleDispatchCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建车辆调度"""
    try:
        return await VehicleDispatchService.create_vehicle_dispatch(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[VehicleDispatchResponse], summary="获取车辆调度列表")
async def list_vehicle_dispatches(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="调度状态（过滤）"),
    vehicle_id: Optional[int] = Query(None, description="车辆ID（过滤）")
):
    """获取车辆调度列表"""
    return await VehicleDispatchService.list_vehicle_dispatches(tenant_id, skip, limit, status, vehicle_id)


@router.get("/{dispatch_uuid}", response_model=VehicleDispatchResponse, summary="获取车辆调度详情")
async def get_vehicle_dispatch(
    dispatch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取车辆调度详情"""
    try:
        return await VehicleDispatchService.get_vehicle_dispatch_by_uuid(tenant_id, dispatch_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{dispatch_uuid}", response_model=VehicleDispatchResponse, summary="更新车辆调度")
async def update_vehicle_dispatch(
    dispatch_uuid: str,
    data: VehicleDispatchUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新车辆调度"""
    try:
        return await VehicleDispatchService.update_vehicle_dispatch(tenant_id, dispatch_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{dispatch_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除车辆调度")
async def delete_vehicle_dispatch(
    dispatch_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除车辆调度"""
    try:
        await VehicleDispatchService.delete_vehicle_dispatch(tenant_id, dispatch_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

