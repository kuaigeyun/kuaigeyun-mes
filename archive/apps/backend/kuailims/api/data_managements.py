"""
数据管理 API 模块

提供数据管理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuailims.services.data_management_service import DataManagementService
from apps.kuailims.schemas.data_management_schemas import (
    DataManagementCreate, DataManagementUpdate, DataManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/data-managements", tags=["DataManagements"])


@router.post("", response_model=DataManagementResponse, status_code=status.HTTP_201_CREATED, summary="创建数据管理")
async def create_data_management(
    data: DataManagementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建数据管理"""
    try:
        return await DataManagementService.create_data_management(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DataManagementResponse], summary="获取数据管理列表")
async def list_data_managements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    data_type: Optional[str] = Query(None, description="数据类型（过滤）"),
    validation_status: Optional[str] = Query(None, description="校验状态（过滤）"),
    audit_status: Optional[str] = Query(None, description="审核状态（过滤）")
):
    """获取数据管理列表"""
    return await DataManagementService.list_data_managements(tenant_id, skip, limit, data_type, validation_status, audit_status)


@router.get("/{management_uuid}", response_model=DataManagementResponse, summary="获取数据管理详情")
async def get_data_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取数据管理详情"""
    try:
        return await DataManagementService.get_data_management_by_uuid(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{management_uuid}", response_model=DataManagementResponse, summary="更新数据管理")
async def update_data_management(
    management_uuid: str,
    data: DataManagementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新数据管理"""
    try:
        return await DataManagementService.update_data_management(tenant_id, management_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{management_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除数据管理")
async def delete_data_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除数据管理"""
    try:
        await DataManagementService.delete_data_management(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

