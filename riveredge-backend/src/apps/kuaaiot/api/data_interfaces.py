"""
数据接口 API 模块

提供数据接口的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaaiot.services.data_interface_service import DataInterfaceService
from apps.kuaaiot.schemas.data_interface_schemas import (
    DataInterfaceCreate, DataInterfaceUpdate, DataInterfaceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/data-interfaces", tags=["DataInterfaces"])


@router.post("", response_model=DataInterfaceResponse, status_code=status.HTTP_201_CREATED, summary="创建数据接口")
async def create_data_interface(
    data: DataInterfaceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建数据接口"""
    try:
        return await DataInterfaceService.create_data_interface(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DataInterfaceResponse], summary="获取数据接口列表")
async def list_data_interfaces(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    interface_type: Optional[str] = Query(None, description="接口类型（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取数据接口列表"""
    return await DataInterfaceService.list_data_interfaces(tenant_id, skip, limit, interface_type, status)


@router.get("/{interface_uuid}", response_model=DataInterfaceResponse, summary="获取数据接口详情")
async def get_data_interface(
    interface_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取数据接口详情"""
    try:
        return await DataInterfaceService.get_data_interface_by_uuid(tenant_id, interface_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{interface_uuid}", response_model=DataInterfaceResponse, summary="更新数据接口")
async def update_data_interface(
    interface_uuid: str,
    data: DataInterfaceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新数据接口"""
    try:
        return await DataInterfaceService.update_data_interface(tenant_id, interface_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{interface_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除数据接口")
async def delete_data_interface(
    interface_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除数据接口"""
    try:
        await DataInterfaceService.delete_data_interface(tenant_id, interface_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

