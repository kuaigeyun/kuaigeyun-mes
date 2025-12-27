"""
质量指标服务模块

提供质量指标的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.quality_indicator import QualityIndicator
from apps.kuaiqms.schemas.quality_indicator_schemas import (
    QualityIndicatorCreate, QualityIndicatorUpdate, QualityIndicatorResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class QualityIndicatorService:
    """质量指标服务"""
    
    @staticmethod
    async def create_quality_indicator(
        tenant_id: int,
        data: QualityIndicatorCreate
    ) -> QualityIndicatorResponse:
        """创建质量指标"""
        existing = await QualityIndicator.filter(
            tenant_id=tenant_id,
            indicator_no=data.indicator_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"指标编号 {data.indicator_no} 已存在")
        
        indicator = await QualityIndicator.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return QualityIndicatorResponse.model_validate(indicator)
    
    @staticmethod
    async def get_quality_indicator_by_uuid(
        tenant_id: int,
        indicator_uuid: str
    ) -> QualityIndicatorResponse:
        """根据UUID获取质量指标"""
        indicator = await QualityIndicator.filter(
            tenant_id=tenant_id,
            uuid=indicator_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not indicator:
            raise NotFoundError(f"质量指标 {indicator_uuid} 不存在")
        
        return QualityIndicatorResponse.model_validate(indicator)
    
    @staticmethod
    async def list_quality_indicators(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        indicator_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[QualityIndicatorResponse]:
        """获取质量指标列表"""
        query = QualityIndicator.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if indicator_type:
            query = query.filter(indicator_type=indicator_type)
        if status:
            query = query.filter(status=status)
        
        indicators = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [QualityIndicatorResponse.model_validate(i) for i in indicators]
    
    @staticmethod
    async def update_quality_indicator(
        tenant_id: int,
        indicator_uuid: str,
        data: QualityIndicatorUpdate
    ) -> QualityIndicatorResponse:
        """更新质量指标"""
        indicator = await QualityIndicator.filter(
            tenant_id=tenant_id,
            uuid=indicator_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not indicator:
            raise NotFoundError(f"质量指标 {indicator_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(indicator, key, value)
        
        await indicator.save()
        
        return QualityIndicatorResponse.model_validate(indicator)
    
    @staticmethod
    async def delete_quality_indicator(
        tenant_id: int,
        indicator_uuid: str
    ) -> None:
        """删除质量指标（软删除）"""
        indicator = await QualityIndicator.filter(
            tenant_id=tenant_id,
            uuid=indicator_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not indicator:
            raise NotFoundError(f"质量指标 {indicator_uuid} 不存在")
        
        indicator.deleted_at = datetime.utcnow()
        await indicator.save()
