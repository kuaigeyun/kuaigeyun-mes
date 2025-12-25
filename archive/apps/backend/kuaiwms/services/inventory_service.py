"""
库存服务模块

提供库存的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiwms.models.inventory import Inventory
from apps.kuaiwms.schemas.inventory_schemas import InventoryResponse
from infra.exceptions.exceptions import NotFoundError


class InventoryService:
    """库存服务"""
    
    @staticmethod
    async def get_inventory_by_uuid(
        tenant_id: int,
        inventory_uuid: str
    ) -> InventoryResponse:
        """
        根据UUID获取库存
        
        Args:
            tenant_id: 租户ID
            inventory_uuid: 库存UUID
            
        Returns:
            InventoryResponse: 库存对象
            
        Raises:
            NotFoundError: 当库存不存在时抛出
        """
        inventory = await Inventory.filter(
            tenant_id=tenant_id,
            uuid=inventory_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not inventory:
            raise NotFoundError(f"库存 {inventory_uuid} 不存在")
        
        return InventoryResponse.model_validate(inventory)
    
    @staticmethod
    async def list_inventories(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        location_id: Optional[int] = None
    ) -> List[InventoryResponse]:
        """
        获取库存列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            material_id: 物料ID（过滤）
            warehouse_id: 仓库ID（过滤）
            location_id: 库位ID（过滤）
            
        Returns:
            List[InventoryResponse]: 库存列表
        """
        query = Inventory.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if material_id:
            query = query.filter(material_id=material_id)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if location_id:
            query = query.filter(location_id=location_id)
        
        inventories = await query.offset(skip).limit(limit).order_by("-updated_at")
        
        return [InventoryResponse.model_validate(inv) for inv in inventories]
