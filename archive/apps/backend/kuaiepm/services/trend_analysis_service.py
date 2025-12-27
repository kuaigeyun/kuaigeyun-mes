"""
趋势分析服务模块

提供趋势分析的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.business_analysis import TrendAnalysis
from apps.kuaiepm.schemas.trend_analysis_schemas import (
    TrendAnalysisCreate, TrendAnalysisUpdate, TrendAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class TrendAnalysisService:
    """趋势分析服务"""
    
    @staticmethod
    async def create_trendanalysis(
        tenant_id: int,
        data: TrendAnalysisCreate
    ) -> TrendAnalysisResponse:
        """
        创建趋势分析
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            TrendAnalysisResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await TrendAnalysis.filter(
            tenant_id=tenant_id,
            analysis_no=data.analysis_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"分析编号 {data.analysis_no} 已存在")
        
        # 创建对象
        obj = await TrendAnalysis.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return TrendAnalysisResponse.model_validate(obj)
    
    @staticmethod
    async def get_trendanalysis_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> TrendAnalysisResponse:
        """
        根据UUID获取趋势分析
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            TrendAnalysisResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await TrendAnalysis.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"趋势分析 {obj_uuid} 不存在")
        
        return TrendAnalysisResponse.model_validate(obj)
    
    @staticmethod
    async def list_trendanalysiss(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[TrendAnalysisResponse]:
        """
        获取趋势分析列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[TrendAnalysisResponse]: 对象列表
        """
        query = TrendAnalysis.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [TrendAnalysisResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_trendanalysis(
        tenant_id: int,
        obj_uuid: str,
        data: TrendAnalysisUpdate
    ) -> TrendAnalysisResponse:
        """
        更新趋势分析
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            TrendAnalysisResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await TrendAnalysis.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"趋势分析 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return TrendAnalysisResponse.model_validate(obj)
    
    @staticmethod
    async def delete_trendanalysis(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除趋势分析（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await TrendAnalysis.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"趋势分析 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
