"""
保修服务模块

提供保修的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.warranty import Warranty
from apps.kuaicrm.schemas.warranty_schemas import (
    WarrantyCreate, WarrantyUpdate, WarrantyResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class WarrantyService:
    """保修服务"""
    
    @staticmethod
    async def create_warranty(
        tenant_id: int,
        data: WarrantyCreate
    ) -> WarrantyResponse:
        """
        创建保修
        
        Args:
            tenant_id: 租户ID
            data: 保修创建数据
            
        Returns:
            WarrantyResponse: 创建的保修对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Warranty.filter(
            tenant_id=tenant_id,
            warranty_no=data.warranty_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"保修编号 {data.warranty_no} 已存在")
        
        # 创建保修
        warranty = await Warranty.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return WarrantyResponse.model_validate(warranty)
    
    @staticmethod
    async def get_warranty_by_uuid(
        tenant_id: int,
        warranty_uuid: str
    ) -> WarrantyResponse:
        """
        根据UUID获取保修
        
        Args:
            tenant_id: 租户ID
            warranty_uuid: 保修UUID
            
        Returns:
            WarrantyResponse: 保修对象
            
        Raises:
            NotFoundError: 当保修不存在时抛出
        """
        warranty = await Warranty.filter(
            tenant_id=tenant_id,
            uuid=warranty_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not warranty:
            raise NotFoundError(f"保修 {warranty_uuid} 不存在")
        
        return WarrantyResponse.model_validate(warranty)
    
    @staticmethod
    async def list_warranties(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        warranty_status: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> List[WarrantyResponse]:
        """
        获取保修列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            warranty_status: 保修状态（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            List[WarrantyResponse]: 保修列表
        """
        query = Warranty.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if warranty_status:
            query = query.filter(warranty_status=warranty_status)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        warranties = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [WarrantyResponse.model_validate(w) for w in warranties]
    
    @staticmethod
    async def update_warranty(
        tenant_id: int,
        warranty_uuid: str,
        data: WarrantyUpdate
    ) -> WarrantyResponse:
        """
        更新保修
        
        Args:
            tenant_id: 租户ID
            warranty_uuid: 保修UUID
            data: 保修更新数据
            
        Returns:
            WarrantyResponse: 更新后的保修对象
            
        Raises:
            NotFoundError: 当保修不存在时抛出
        """
        warranty = await Warranty.filter(
            tenant_id=tenant_id,
            uuid=warranty_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not warranty:
            raise NotFoundError(f"保修 {warranty_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(warranty, key, value)
        
        await warranty.save()
        
        return WarrantyResponse.model_validate(warranty)
    
    @staticmethod
    async def delete_warranty(
        tenant_id: int,
        warranty_uuid: str
    ) -> None:
        """
        删除保修（软删除）
        
        Args:
            tenant_id: 租户ID
            warranty_uuid: 保修UUID
            
        Raises:
            NotFoundError: 当保修不存在时抛出
        """
        warranty = await Warranty.filter(
            tenant_id=tenant_id,
            uuid=warranty_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not warranty:
            raise NotFoundError(f"保修 {warranty_uuid} 不存在")
        
        from datetime import datetime
        warranty.deleted_at = datetime.utcnow()
        await warranty.save()
