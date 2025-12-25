"""
不合格品记录服务模块

提供不合格品记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.nonconforming_product import NonconformingProduct
from apps.kuaiqms.schemas.nonconforming_product_schemas import (
    NonconformingProductCreate, NonconformingProductUpdate, NonconformingProductResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class NonconformingProductService:
    """不合格品记录服务"""
    
    @staticmethod
    async def create_nonconforming_product(
        tenant_id: int,
        data: NonconformingProductCreate
    ) -> NonconformingProductResponse:
        """创建不合格品记录"""
        existing = await NonconformingProduct.filter(
            tenant_id=tenant_id,
            record_no=data.record_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"不合格品记录编号 {data.record_no} 已存在")
        
        record = await NonconformingProduct.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return NonconformingProductResponse.model_validate(record)
    
    @staticmethod
    async def get_nonconforming_product_by_uuid(
        tenant_id: int,
        record_uuid: str
    ) -> NonconformingProductResponse:
        """根据UUID获取不合格品记录"""
        record = await NonconformingProduct.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"不合格品记录 {record_uuid} 不存在")
        
        return NonconformingProductResponse.model_validate(record)
    
    @staticmethod
    async def list_nonconforming_products(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        defect_type: Optional[int] = None
    ) -> List[NonconformingProductResponse]:
        """获取不合格品记录列表"""
        query = NonconformingProduct.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if defect_type:
            query = query.filter(defect_type=defect_type)
        
        records = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [NonconformingProductResponse.model_validate(r) for r in records]
    
    @staticmethod
    async def update_nonconforming_product(
        tenant_id: int,
        record_uuid: str,
        data: NonconformingProductUpdate
    ) -> NonconformingProductResponse:
        """更新不合格品记录"""
        record = await NonconformingProduct.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"不合格品记录 {record_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(record, key, value)
        
        await record.save()
        
        return NonconformingProductResponse.model_validate(record)
    
    @staticmethod
    async def delete_nonconforming_product(
        tenant_id: int,
        record_uuid: str
    ) -> None:
        """删除不合格品记录（软删除）"""
        record = await NonconformingProduct.filter(
            tenant_id=tenant_id,
            uuid=record_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not record:
            raise NotFoundError(f"不合格品记录 {record_uuid} 不存在")
        
        record.deleted_at = datetime.utcnow()
        await record.save()
