"""
计划调整服务模块

提供计划调整的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiaps.models.plan_adjustment import PlanAdjustment
from apps.kuaiaps.schemas.plan_adjustment_schemas import (
    PlanAdjustmentCreate, PlanAdjustmentUpdate, PlanAdjustmentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PlanAdjustmentService:
    """计划调整服务"""
    
    @staticmethod
    async def create_plan_adjustment(
        tenant_id: int,
        data: PlanAdjustmentCreate
    ) -> PlanAdjustmentResponse:
        """创建计划调整"""
        existing = await PlanAdjustment.filter(
            tenant_id=tenant_id,
            adjustment_no=data.adjustment_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"计划调整编号 {data.adjustment_no} 已存在")
        
        adjustment = await PlanAdjustment.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return PlanAdjustmentResponse.model_validate(adjustment)
    
    @staticmethod
    async def get_plan_adjustment_by_uuid(
        tenant_id: int,
        adjustment_uuid: str
    ) -> PlanAdjustmentResponse:
        """根据UUID获取计划调整"""
        adjustment = await PlanAdjustment.filter(
            tenant_id=tenant_id,
            uuid=adjustment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not adjustment:
            raise NotFoundError(f"计划调整 {adjustment_uuid} 不存在")
        
        return PlanAdjustmentResponse.model_validate(adjustment)
    
    @staticmethod
    async def list_plan_adjustments(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        adjustment_type: Optional[str] = None,
        approval_status: Optional[str] = None,
        adjustment_status: Optional[str] = None
    ) -> List[PlanAdjustmentResponse]:
        """获取计划调整列表"""
        query = PlanAdjustment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if adjustment_type:
            query = query.filter(adjustment_type=adjustment_type)
        if approval_status:
            query = query.filter(approval_status=approval_status)
        if adjustment_status:
            query = query.filter(adjustment_status=adjustment_status)
        
        adjustments = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [PlanAdjustmentResponse.model_validate(a) for a in adjustments]
    
    @staticmethod
    async def update_plan_adjustment(
        tenant_id: int,
        adjustment_uuid: str,
        data: PlanAdjustmentUpdate
    ) -> PlanAdjustmentResponse:
        """更新计划调整"""
        adjustment = await PlanAdjustment.filter(
            tenant_id=tenant_id,
            uuid=adjustment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not adjustment:
            raise NotFoundError(f"计划调整 {adjustment_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(adjustment, key, value)
        
        await adjustment.save()
        
        return PlanAdjustmentResponse.model_validate(adjustment)
    
    @staticmethod
    async def delete_plan_adjustment(
        tenant_id: int,
        adjustment_uuid: str
    ) -> None:
        """删除计划调整（软删除）"""
        adjustment = await PlanAdjustment.filter(
            tenant_id=tenant_id,
            uuid=adjustment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not adjustment:
            raise NotFoundError(f"计划调整 {adjustment_uuid} 不存在")
        
        adjustment.deleted_at = datetime.utcnow()
        await adjustment.save()

