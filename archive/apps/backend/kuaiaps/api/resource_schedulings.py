"""
资源调度 API 模块

提供资源调度的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiaps.services.resource_scheduling_service import ResourceSchedulingService
from apps.kuaiaps.schemas.resource_scheduling_schemas import (
    ResourceSchedulingCreate, ResourceSchedulingUpdate, ResourceSchedulingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/resource-schedulings", tags=["ResourceSchedulings"])


@router.post("", response_model=ResourceSchedulingResponse, status_code=status.HTTP_201_CREATED, summary="创建资源调度")
async def create_resource_scheduling(
    data: ResourceSchedulingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建资源调度"""
    try:
        return await ResourceSchedulingService.create_resource_scheduling(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ResourceSchedulingResponse], summary="获取资源调度列表")
async def list_resource_schedulings(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    resource_type: Optional[str] = Query(None, description="资源类型（过滤）"),
    availability_status: Optional[str] = Query(None, description="可用性状态（过滤）"),
    scheduling_status: Optional[str] = Query(None, description="调度状态（过滤）")
):
    """获取资源调度列表"""
    return await ResourceSchedulingService.list_resource_schedulings(tenant_id, skip, limit, resource_type, availability_status, scheduling_status)


@router.get("/{scheduling_uuid}", response_model=ResourceSchedulingResponse, summary="获取资源调度详情")
async def get_resource_scheduling(
    scheduling_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取资源调度详情"""
    try:
        return await ResourceSchedulingService.get_resource_scheduling_by_uuid(tenant_id, scheduling_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{scheduling_uuid}", response_model=ResourceSchedulingResponse, summary="更新资源调度")
async def update_resource_scheduling(
    scheduling_uuid: str,
    data: ResourceSchedulingUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新资源调度"""
    try:
        return await ResourceSchedulingService.update_resource_scheduling(tenant_id, scheduling_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{scheduling_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除资源调度")
async def delete_resource_scheduling(
    scheduling_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除资源调度"""
    try:
        await ResourceSchedulingService.delete_resource_scheduling(tenant_id, scheduling_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

