"""
绩效评估服务模块

提供绩效评估的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.balanced_scorecard import PerformanceEvaluation
from apps.kuaiepm.schemas.performance_evaluation_schemas import (
    PerformanceEvaluationCreate, PerformanceEvaluationUpdate, PerformanceEvaluationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PerformanceEvaluationService:
    """绩效评估服务"""
    
    @staticmethod
    async def create_performanceevaluation(
        tenant_id: int,
        data: PerformanceEvaluationCreate
    ) -> PerformanceEvaluationResponse:
        """
        创建绩效评估
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            PerformanceEvaluationResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await PerformanceEvaluation.filter(
            tenant_id=tenant_id,
            evaluation_no=data.evaluation_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"评估编号 {data.evaluation_no} 已存在")
        
        # 创建对象
        obj = await PerformanceEvaluation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return PerformanceEvaluationResponse.model_validate(obj)
    
    @staticmethod
    async def get_performanceevaluation_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> PerformanceEvaluationResponse:
        """
        根据UUID获取绩效评估
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            PerformanceEvaluationResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await PerformanceEvaluation.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"绩效评估 {obj_uuid} 不存在")
        
        return PerformanceEvaluationResponse.model_validate(obj)
    
    @staticmethod
    async def list_performanceevaluations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[PerformanceEvaluationResponse]:
        """
        获取绩效评估列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[PerformanceEvaluationResponse]: 对象列表
        """
        query = PerformanceEvaluation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [PerformanceEvaluationResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_performanceevaluation(
        tenant_id: int,
        obj_uuid: str,
        data: PerformanceEvaluationUpdate
    ) -> PerformanceEvaluationResponse:
        """
        更新绩效评估
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            PerformanceEvaluationResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await PerformanceEvaluation.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"绩效评估 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return PerformanceEvaluationResponse.model_validate(obj)
    
    @staticmethod
    async def delete_performanceevaluation(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除绩效评估（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await PerformanceEvaluation.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"绩效评估 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
