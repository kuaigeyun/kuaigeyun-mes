"""
运输需求 API 模块

提供运输需求的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaitms.services.transport_demand_service import TransportDemandService
from apps.kuaitms.schemas.transport_demand_schemas import (
    TransportDemandCreate, TransportDemandUpdate, TransportDemandResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/transport-demands", tags=["TransportDemands"])


@router.post("", response_model=TransportDemandResponse, status_code=status.HTTP_201_CREATED, summary="创建运输需求")
async def create_transport_demand(
    data: TransportDemandCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建运输需求"""
    try:
        return await TransportDemandService.create_transport_demand(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[TransportDemandResponse], summary="获取运输需求列表")
async def list_transport_demands(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="需求状态（过滤）"),
    source_type: Optional[str] = Query(None, description="来源类型（过滤）")
):
    """获取运输需求列表"""
    return await TransportDemandService.list_transport_demands(tenant_id, skip, limit, status, source_type)


@router.get("/{demand_uuid}", response_model=TransportDemandResponse, summary="获取运输需求详情")
async def get_transport_demand(
    demand_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取运输需求详情"""
    try:
        return await TransportDemandService.get_transport_demand_by_uuid(tenant_id, demand_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{demand_uuid}", response_model=TransportDemandResponse, summary="更新运输需求")
async def update_transport_demand(
    demand_uuid: str,
    data: TransportDemandUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新运输需求"""
    try:
        return await TransportDemandService.update_transport_demand(tenant_id, demand_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{demand_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除运输需求")
async def delete_transport_demand(
    demand_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除运输需求"""
    try:
        await TransportDemandService.delete_transport_demand(tenant_id, demand_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

