"""
供应链网络 API 模块

提供供应链网络的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiscm.services.supply_chain_network_service import SupplyChainNetworkService
from apps.kuaiscm.schemas.supply_chain_network_schemas import (
    SupplyChainNetworkCreate, SupplyChainNetworkUpdate, SupplyChainNetworkResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/supply-chain-networks", tags=["SupplyChainNetworks"])


@router.post("", response_model=SupplyChainNetworkResponse, status_code=status.HTTP_201_CREATED, summary="创建供应链网络")
async def create_supply_chain_network(
    data: SupplyChainNetworkCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建供应链网络"""
    try:
        return await SupplyChainNetworkService.create_supply_chain_network(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SupplyChainNetworkResponse], summary="获取供应链网络列表")
async def list_supply_chain_networks(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    node_type: Optional[str] = Query(None, description="节点类型（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取供应链网络列表"""
    return await SupplyChainNetworkService.list_supply_chain_networks(tenant_id, skip, limit, node_type, status)


@router.get("/{network_uuid}", response_model=SupplyChainNetworkResponse, summary="获取供应链网络详情")
async def get_supply_chain_network(
    network_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取供应链网络详情"""
    try:
        return await SupplyChainNetworkService.get_supply_chain_network_by_uuid(tenant_id, network_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{network_uuid}", response_model=SupplyChainNetworkResponse, summary="更新供应链网络")
async def update_supply_chain_network(
    network_uuid: str,
    data: SupplyChainNetworkUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新供应链网络"""
    try:
        return await SupplyChainNetworkService.update_supply_chain_network(tenant_id, network_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{network_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除供应链网络")
async def delete_supply_chain_network(
    network_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除供应链网络"""
    try:
        await SupplyChainNetworkService.delete_supply_chain_network(tenant_id, network_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

