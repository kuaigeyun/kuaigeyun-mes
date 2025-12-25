"""
供应商评估服务模块

提供供应商评估的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from apps.kuaisrm.models.supplier_evaluation import SupplierEvaluation
from apps.kuaisrm.schemas.supplier_evaluation_schemas import (
    SupplierEvaluationCreate, SupplierEvaluationUpdate, SupplierEvaluationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SupplierEvaluationService:
    """供应商评估服务"""
    
    @staticmethod
    async def create_supplier_evaluation(
        tenant_id: int,
        data: SupplierEvaluationCreate
    ) -> SupplierEvaluationResponse:
        """
        创建供应商评估
        
        Args:
            tenant_id: 租户ID
            data: 评估创建数据
            
        Returns:
            SupplierEvaluationResponse: 创建的评估对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SupplierEvaluation.filter(
            tenant_id=tenant_id,
            evaluation_no=data.evaluation_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"评估编号 {data.evaluation_no} 已存在")
        
        # 计算综合评分（如果未提供）
        if not data.total_score or data.total_score == 0:
            # 简单平均计算（实际可以根据权重计算）
            total = (data.quality_score + data.delivery_score + data.price_score + data.service_score) / 4
            data.total_score = Decimal(str(total))
        
        # 确定评估等级
        if not data.evaluation_level:
            if data.total_score >= 90:
                data.evaluation_level = "A"
            elif data.total_score >= 80:
                data.evaluation_level = "B"
            elif data.total_score >= 70:
                data.evaluation_level = "C"
            else:
                data.evaluation_level = "D"
        
        # 创建评估
        evaluation = await SupplierEvaluation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SupplierEvaluationResponse.model_validate(evaluation)
    
    @staticmethod
    async def get_supplier_evaluation_by_uuid(
        tenant_id: int,
        evaluation_uuid: str
    ) -> SupplierEvaluationResponse:
        """
        根据UUID获取供应商评估
        
        Args:
            tenant_id: 租户ID
            evaluation_uuid: 评估UUID
            
        Returns:
            SupplierEvaluationResponse: 评估对象
            
        Raises:
            NotFoundError: 当评估不存在时抛出
        """
        evaluation = await SupplierEvaluation.filter(
            tenant_id=tenant_id,
            uuid=evaluation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not evaluation:
            raise NotFoundError(f"供应商评估 {evaluation_uuid} 不存在")
        
        return SupplierEvaluationResponse.model_validate(evaluation)
    
    @staticmethod
    async def list_supplier_evaluations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        supplier_id: Optional[int] = None,
        evaluation_period: Optional[str] = None
    ) -> List[SupplierEvaluationResponse]:
        """
        获取供应商评估列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            supplier_id: 供应商ID（过滤）
            evaluation_period: 评估周期（过滤）
            
        Returns:
            List[SupplierEvaluationResponse]: 评估列表
        """
        query = SupplierEvaluation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        if evaluation_period:
            query = query.filter(evaluation_period=evaluation_period)
        
        evaluations = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SupplierEvaluationResponse.model_validate(eval) for eval in evaluations]
    
    @staticmethod
    async def update_supplier_evaluation(
        tenant_id: int,
        evaluation_uuid: str,
        data: SupplierEvaluationUpdate
    ) -> SupplierEvaluationResponse:
        """
        更新供应商评估
        
        Args:
            tenant_id: 租户ID
            evaluation_uuid: 评估UUID
            data: 评估更新数据
            
        Returns:
            SupplierEvaluationResponse: 更新后的评估对象
            
        Raises:
            NotFoundError: 当评估不存在时抛出
        """
        evaluation = await SupplierEvaluation.filter(
            tenant_id=tenant_id,
            uuid=evaluation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not evaluation:
            raise NotFoundError(f"供应商评估 {evaluation_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        
        # 如果更新了单项评分，重新计算综合评分
        if any(key in update_data for key in ['quality_score', 'delivery_score', 'price_score', 'service_score']):
            quality = update_data.get('quality_score', evaluation.quality_score)
            delivery = update_data.get('delivery_score', evaluation.delivery_score)
            price = update_data.get('price_score', evaluation.price_score)
            service = update_data.get('service_score', evaluation.service_score)
            total = (quality + delivery + price + service) / 4
            update_data['total_score'] = Decimal(str(total))
            
            # 重新确定评估等级
            if total >= 90:
                update_data['evaluation_level'] = "A"
            elif total >= 80:
                update_data['evaluation_level'] = "B"
            elif total >= 70:
                update_data['evaluation_level'] = "C"
            else:
                update_data['evaluation_level'] = "D"
        
        for key, value in update_data.items():
            setattr(evaluation, key, value)
        
        await evaluation.save()
        
        return SupplierEvaluationResponse.model_validate(evaluation)
    
    @staticmethod
    async def delete_supplier_evaluation(
        tenant_id: int,
        evaluation_uuid: str
    ) -> None:
        """
        删除供应商评估（软删除）
        
        Args:
            tenant_id: 租户ID
            evaluation_uuid: 评估UUID
            
        Raises:
            NotFoundError: 当评估不存在时抛出
        """
        evaluation = await SupplierEvaluation.filter(
            tenant_id=tenant_id,
            uuid=evaluation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not evaluation:
            raise NotFoundError(f"供应商评估 {evaluation_uuid} 不存在")
        
        evaluation.deleted_at = datetime.utcnow()
        await evaluation.save()
