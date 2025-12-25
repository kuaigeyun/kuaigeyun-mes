"""
LRP批次服务模块

提供LRP批次的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimrp.models.lrp_batch import LRPBatch
from apps.kuaimrp.schemas.lrp_batch_schemas import (
    LRPBatchCreate, LRPBatchUpdate, LRPBatchResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class LRPBatchService:
    """LRP批次服务"""
    
    @staticmethod
    async def create_lrp_batch(
        tenant_id: int,
        data: LRPBatchCreate
    ) -> LRPBatchResponse:
        """
        创建LRP批次
        
        Args:
            tenant_id: 租户ID
            data: 批次创建数据
            
        Returns:
            LRPBatchResponse: 创建的批次对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await LRPBatch.filter(
            tenant_id=tenant_id,
            batch_no=data.batch_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"批次编号 {data.batch_no} 已存在")
        
        # 创建批次
        batch = await LRPBatch.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return LRPBatchResponse.model_validate(batch)
    
    @staticmethod
    async def get_lrp_batch_by_uuid(
        tenant_id: int,
        batch_uuid: str
    ) -> LRPBatchResponse:
        """
        根据UUID获取LRP批次
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批次UUID
            
        Returns:
            LRPBatchResponse: 批次对象
            
        Raises:
            NotFoundError: 当批次不存在时抛出
        """
        batch = await LRPBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not batch:
            raise NotFoundError(f"LRP批次 {batch_uuid} 不存在")
        
        return LRPBatchResponse.model_validate(batch)
    
    @staticmethod
    async def list_lrp_batches(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[LRPBatchResponse]:
        """
        获取LRP批次列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 批次状态（过滤）
            
        Returns:
            List[LRPBatchResponse]: 批次列表
        """
        query = LRPBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        batches = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [LRPBatchResponse.model_validate(batch) for batch in batches]
    
    @staticmethod
    async def update_lrp_batch(
        tenant_id: int,
        batch_uuid: str,
        data: LRPBatchUpdate
    ) -> LRPBatchResponse:
        """
        更新LRP批次
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批次UUID
            data: 批次更新数据
            
        Returns:
            LRPBatchResponse: 更新后的批次对象
            
        Raises:
            NotFoundError: 当批次不存在时抛出
        """
        batch = await LRPBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not batch:
            raise NotFoundError(f"LRP批次 {batch_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(batch, key, value)
        
        await batch.save()
        
        return LRPBatchResponse.model_validate(batch)
    
    @staticmethod
    async def delete_lrp_batch(
        tenant_id: int,
        batch_uuid: str
    ) -> None:
        """
        删除LRP批次（软删除）
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批次UUID
            
        Raises:
            NotFoundError: 当批次不存在时抛出
        """
        batch = await LRPBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not batch:
            raise NotFoundError(f"LRP批次 {batch_uuid} 不存在")
        
        batch.deleted_at = datetime.utcnow()
        await batch.save()
    
    @staticmethod
    async def calculate_lrp(
        tenant_id: int,
        batch_uuid: str
    ) -> LRPBatchResponse:
        """
        执行LRP计算
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批次UUID
            
        Returns:
            LRPBatchResponse: 更新后的批次对象
            
        Raises:
            NotFoundError: 当批次不存在时抛出
            ValidationError: 当批次状态不允许计算时抛出
        """
        batch = await LRPBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not batch:
            raise NotFoundError(f"LRP批次 {batch_uuid} 不存在")
        
        # 检查批次状态
        if batch.status not in ["草稿", "已完成"]:
            raise ValidationError(f"批次状态为 {batch.status}，无法执行计算")
        
        # 更新状态为计算中
        batch.status = "计算中"
        await batch.save()
        
        # TODO: 实现LRP计算逻辑
        # 这里应该调用LRP计算引擎，按订单分解物料需求
        
        # 更新状态为已完成
        batch.status = "已完成"
        await batch.save()
        
        return LRPBatchResponse.model_validate(batch)
