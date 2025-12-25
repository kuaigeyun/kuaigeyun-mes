"""
备件采购服务模块

提供备件采购的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.spare_part_purchase import SparePartPurchase
from apps.kuaieam.schemas.spare_part_purchase_schemas import (
    SparePartPurchaseCreate, SparePartPurchaseUpdate, SparePartPurchaseResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SparePartPurchaseService:
    """备件采购服务"""
    
    @staticmethod
    async def create_spare_part_purchase(
        tenant_id: int,
        data: SparePartPurchaseCreate
    ) -> SparePartPurchaseResponse:
        """创建备件采购"""
        existing = await SparePartPurchase.filter(
            tenant_id=tenant_id,
            purchase_no=data.purchase_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"备件采购单编号 {data.purchase_no} 已存在")
        
        purchase = await SparePartPurchase.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SparePartPurchaseResponse.model_validate(purchase)
    
    @staticmethod
    async def get_spare_part_purchase_by_uuid(
        tenant_id: int,
        purchase_uuid: str
    ) -> SparePartPurchaseResponse:
        """根据UUID获取备件采购"""
        purchase = await SparePartPurchase.filter(
            tenant_id=tenant_id,
            uuid=purchase_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not purchase:
            raise NotFoundError(f"备件采购 {purchase_uuid} 不存在")
        
        return SparePartPurchaseResponse.model_validate(purchase)
    
    @staticmethod
    async def list_spare_part_purchases(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        demand_uuid: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SparePartPurchaseResponse]:
        """获取备件采购列表"""
        query = SparePartPurchase.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if demand_uuid:
            query = query.filter(demand_uuid=demand_uuid)
        if status:
            query = query.filter(status=status)
        
        purchases = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SparePartPurchaseResponse.model_validate(p) for p in purchases]
    
    @staticmethod
    async def update_spare_part_purchase(
        tenant_id: int,
        purchase_uuid: str,
        data: SparePartPurchaseUpdate
    ) -> SparePartPurchaseResponse:
        """更新备件采购"""
        purchase = await SparePartPurchase.filter(
            tenant_id=tenant_id,
            uuid=purchase_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not purchase:
            raise NotFoundError(f"备件采购 {purchase_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(purchase, key, value)
        
        await purchase.save()
        
        return SparePartPurchaseResponse.model_validate(purchase)
    
    @staticmethod
    async def delete_spare_part_purchase(
        tenant_id: int,
        purchase_uuid: str
    ) -> None:
        """删除备件采购（软删除）"""
        purchase = await SparePartPurchase.filter(
            tenant_id=tenant_id,
            uuid=purchase_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not purchase:
            raise NotFoundError(f"备件采购 {purchase_uuid} 不存在")
        
        purchase.deleted_at = datetime.utcnow()
        await purchase.save()
