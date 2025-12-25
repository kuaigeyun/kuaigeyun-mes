"""
样品管理 API 模块

提供样品管理的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuailims.services.sample_management_service import SampleManagementService
from apps.kuailims.schemas.sample_management_schemas import (
    SampleManagementCreate, SampleManagementUpdate, SampleManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/sample-managements", tags=["SampleManagements"])


@router.post("", response_model=SampleManagementResponse, status_code=status.HTTP_201_CREATED, summary="创建样品管理")
async def create_sample_management(
    data: SampleManagementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建样品管理"""
    try:
        return await SampleManagementService.create_sample_management(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SampleManagementResponse], summary="获取样品管理列表")
async def list_sample_managements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    sample_type: Optional[str] = Query(None, description="样品类型（过滤）"),
    sample_status: Optional[str] = Query(None, description="样品状态（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取样品管理列表"""
    return await SampleManagementService.list_sample_managements(tenant_id, skip, limit, sample_type, sample_status, status)


@router.get("/{management_uuid}", response_model=SampleManagementResponse, summary="获取样品管理详情")
async def get_sample_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取样品管理详情"""
    try:
        return await SampleManagementService.get_sample_management_by_uuid(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{management_uuid}", response_model=SampleManagementResponse, summary="更新样品管理")
async def update_sample_management(
    management_uuid: str,
    data: SampleManagementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新样品管理"""
    try:
        return await SampleManagementService.update_sample_management(tenant_id, management_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{management_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除样品管理")
async def delete_sample_management(
    management_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除样品管理"""
    try:
        await SampleManagementService.delete_sample_management(tenant_id, management_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

