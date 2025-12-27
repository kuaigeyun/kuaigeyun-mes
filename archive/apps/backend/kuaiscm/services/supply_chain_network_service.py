"""
供应链网络服务模块

提供供应链网络的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiscm.models.supply_chain_network import SupplyChainNetwork
from apps.kuaiscm.schemas.supply_chain_network_schemas import (
    SupplyChainNetworkCreate, SupplyChainNetworkUpdate, SupplyChainNetworkResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SupplyChainNetworkService:
    """供应链网络服务"""
    
    @staticmethod
    async def create_supply_chain_network(
        tenant_id: int,
        data: SupplyChainNetworkCreate
    ) -> SupplyChainNetworkResponse:
        """创建供应链网络"""
        existing = await SupplyChainNetwork.filter(
            tenant_id=tenant_id,
            network_no=data.network_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"供应链网络编号 {data.network_no} 已存在")
        
        network = await SupplyChainNetwork.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SupplyChainNetworkResponse.model_validate(network)
    
    @staticmethod
    async def get_supply_chain_network_by_uuid(
        tenant_id: int,
        network_uuid: str
    ) -> SupplyChainNetworkResponse:
        """根据UUID获取供应链网络"""
        network = await SupplyChainNetwork.filter(
            tenant_id=tenant_id,
            uuid=network_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not network:
            raise NotFoundError(f"供应链网络 {network_uuid} 不存在")
        
        return SupplyChainNetworkResponse.model_validate(network)
    
    @staticmethod
    async def list_supply_chain_networks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        node_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SupplyChainNetworkResponse]:
        """获取供应链网络列表"""
        query = SupplyChainNetwork.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if node_type:
            query = query.filter(node_type=node_type)
        if status:
            query = query.filter(status=status)
        
        networks = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SupplyChainNetworkResponse.model_validate(n) for n in networks]
    
    @staticmethod
    async def update_supply_chain_network(
        tenant_id: int,
        network_uuid: str,
        data: SupplyChainNetworkUpdate
    ) -> SupplyChainNetworkResponse:
        """更新供应链网络"""
        network = await SupplyChainNetwork.filter(
            tenant_id=tenant_id,
            uuid=network_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not network:
            raise NotFoundError(f"供应链网络 {network_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(network, key, value)
        
        await network.save()
        
        return SupplyChainNetworkResponse.model_validate(network)
    
    @staticmethod
    async def delete_supply_chain_network(
        tenant_id: int,
        network_uuid: str
    ) -> None:
        """删除供应链网络（软删除）"""
        network = await SupplyChainNetwork.filter(
            tenant_id=tenant_id,
            uuid=network_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not network:
            raise NotFoundError(f"供应链网络 {network_uuid} 不存在")
        
        network.deleted_at = datetime.utcnow()
        await network.save()

