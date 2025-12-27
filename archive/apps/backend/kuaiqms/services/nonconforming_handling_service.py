"""
不合格品处理服务模块

提供不合格品处理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.nonconforming_handling import NonconformingHandling
from apps.kuaiqms.schemas.nonconforming_handling_schemas import (
    NonconformingHandlingCreate, NonconformingHandlingUpdate, NonconformingHandlingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class NonconformingHandlingService:
    """不合格品处理服务"""
    
    @staticmethod
    async def create_nonconforming_handling(
        tenant_id: int,
        data: NonconformingHandlingCreate
    ) -> NonconformingHandlingResponse:
        """创建不合格品处理"""
        existing = await NonconformingHandling.filter(
            tenant_id=tenant_id,
            handling_no=data.handling_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"处理单编号 {data.handling_no} 已存在")
        
        handling = await NonconformingHandling.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return NonconformingHandlingResponse.model_validate(handling)
    
    @staticmethod
    async def get_nonconforming_handling_by_uuid(
        tenant_id: int,
        handling_uuid: str
    ) -> NonconformingHandlingResponse:
        """根据UUID获取不合格品处理"""
        handling = await NonconformingHandling.filter(
            tenant_id=tenant_id,
            uuid=handling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not handling:
            raise NotFoundError(f"不合格品处理 {handling_uuid} 不存在")
        
        return NonconformingHandlingResponse.model_validate(handling)
    
    @staticmethod
    async def list_nonconforming_handlings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        handling_type: Optional[str] = None,
        nonconforming_product_uuid: Optional[str] = None
    ) -> List[NonconformingHandlingResponse]:
        """获取不合格品处理列表"""
        query = NonconformingHandling.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if handling_type:
            query = query.filter(handling_type=handling_type)
        if nonconforming_product_uuid:
            query = query.filter(nonconforming_product_uuid=nonconforming_product_uuid)
        
        handlings = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [NonconformingHandlingResponse.model_validate(h) for h in handlings]
    
    @staticmethod
    async def update_nonconforming_handling(
        tenant_id: int,
        handling_uuid: str,
        data: NonconformingHandlingUpdate
    ) -> NonconformingHandlingResponse:
        """更新不合格品处理"""
        handling = await NonconformingHandling.filter(
            tenant_id=tenant_id,
            uuid=handling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not handling:
            raise NotFoundError(f"不合格品处理 {handling_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(handling, key, value)
        
        await handling.save()
        
        return NonconformingHandlingResponse.model_validate(handling)
    
    @staticmethod
    async def delete_nonconforming_handling(
        tenant_id: int,
        handling_uuid: str
    ) -> None:
        """删除不合格品处理（软删除）"""
        handling = await NonconformingHandling.filter(
            tenant_id=tenant_id,
            uuid=handling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not handling:
            raise NotFoundError(f"不合格品处理 {handling_uuid} 不存在")
        
        handling.deleted_at = datetime.utcnow()
        await handling.save()
