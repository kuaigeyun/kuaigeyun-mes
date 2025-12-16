"""
设备数据采集 API 模块

提供设备数据采集的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiiot.services.device_data_collection_service import DeviceDataCollectionService
from apps.kuaiiot.schemas.device_data_collection_schemas import (
    DeviceDataCollectionCreate, DeviceDataCollectionUpdate, DeviceDataCollectionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/device-data-collections", tags=["设备数据采集"])


@router.post("", response_model=DeviceDataCollectionResponse, summary="创建设备数据采集")
async def create_device_data_collection(
    data: DeviceDataCollectionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建设备数据采集"""
    try:
        return await DeviceDataCollectionService.create_device_data_collection(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DeviceDataCollectionResponse], summary="获取设备数据采集列表")
async def list_device_data_collections(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取设备数据采集列表"""
    return await DeviceDataCollectionService.list_device_data_collections(tenant_id, skip, limit, status)


@router.get("/{{obj_uuid}}", response_model=DeviceDataCollectionResponse, summary="获取设备数据采集详情")
async def get_device_data_collection(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取设备数据采集详情"""
    try:
        return await DeviceDataCollectionService.get_device_data_collection_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{{obj_uuid}}", response_model=DeviceDataCollectionResponse, summary="更新设备数据采集")
async def update_device_data_collection(
    obj_uuid: str,
    data: DeviceDataCollectionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新设备数据采集"""
    try:
        return await DeviceDataCollectionService.update_device_data_collection(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{{obj_uuid}}", status_code=status.HTTP_204_NO_CONTENT, summary="删除设备数据采集")
async def delete_device_data_collection(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除设备数据采集"""
    try:
        await DeviceDataCollectionService.delete_device_data_collection(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
