"""
备件需求 API 模块

提供备件需求的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.spare_part_demand_service import SparePartDemandService
from apps.kuaieam.schemas.spare_part_demand_schemas import (
    SparePartDemandCreate, SparePartDemandUpdate, SparePartDemandResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/spare-part-demands", tags=["SparePartDemands"])


@router.post("", response_model=SparePartDemandResponse, status_code=status.HTTP_201_CREATED, summary="创建备件需求")
async def create_spare_part_demand(
    data: SparePartDemandCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建备件需求"""
    try:
        return await SparePartDemandService.create_spare_part_demand(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SparePartDemandResponse], summary="获取备件需求列表")
async def list_spare_part_demands(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    source_type: Optional[str] = Query(None, description="来源类型（过滤）"),
    status: Optional[str] = Query(None, description="需求状态（过滤）")
):
    """获取备件需求列表"""
    return await SparePartDemandService.list_spare_part_demands(tenant_id, skip, limit, source_type, status)


@router.get("/{demand_uuid}", response_model=SparePartDemandResponse, summary="获取备件需求详情")
async def get_spare_part_demand(
    demand_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取备件需求详情"""
    try:
        return await SparePartDemandService.get_spare_part_demand_by_uuid(tenant_id, demand_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{demand_uuid}", response_model=SparePartDemandResponse, summary="更新备件需求")
async def update_spare_part_demand(
    demand_uuid: str,
    data: SparePartDemandUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新备件需求"""
    try:
        return await SparePartDemandService.update_spare_part_demand(tenant_id, demand_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{demand_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除备件需求")
async def delete_spare_part_demand(
    demand_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除备件需求"""
    try:
        await SparePartDemandService.delete_spare_part_demand(tenant_id, demand_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
