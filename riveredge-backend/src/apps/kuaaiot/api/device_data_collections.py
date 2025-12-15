"""
设备数据采集 API 模块

提供设备数据采集的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaaiot.services.device_data_collection_service import DeviceDataCollectionService
from apps.kuaaiot.schemas.device_data_collection_schemas import (
    DeviceDataCollectionCreate, DeviceDataCollectionUpdate, DeviceDataCollectionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/device-data-collections", tags=["DeviceDataCollections"])


@router.post("", response_model=DeviceDataCollectionResponse, status_code=status.HTTP_201_CREATED, summary="创建设备数据采集")
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
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    device_id: Optional[int] = Query(None, description="设备ID（过滤）"),
    collection_status: Optional[str] = Query(None, description="采集状态（过滤）"),
    data_quality: Optional[str] = Query(None, description="数据质量（过滤）")
):
    """获取设备数据采集列表"""
    return await DeviceDataCollectionService.list_device_data_collections(tenant_id, skip, limit, device_id, collection_status, data_quality)


@router.get("/{collection_uuid}", response_model=DeviceDataCollectionResponse, summary="获取设备数据采集详情")
async def get_device_data_collection(
    collection_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取设备数据采集详情"""
    try:
        return await DeviceDataCollectionService.get_device_data_collection_by_uuid(tenant_id, collection_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{collection_uuid}", response_model=DeviceDataCollectionResponse, summary="更新设备数据采集")
async def update_device_data_collection(
    collection_uuid: str,
    data: DeviceDataCollectionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新设备数据采集"""
    try:
        return await DeviceDataCollectionService.update_device_data_collection(tenant_id, collection_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{collection_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除设备数据采集")
async def delete_device_data_collection(
    collection_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除设备数据采集"""
    try:
        await DeviceDataCollectionService.delete_device_data_collection(tenant_id, collection_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

