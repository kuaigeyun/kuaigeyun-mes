"""
生产计划服务模块

提供生产计划的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiaps.models.production_plan import ProductionPlan
from apps.kuaiaps.schemas.production_plan_schemas import (
    ProductionPlanCreate, ProductionPlanUpdate, ProductionPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProductionPlanService:
    """生产计划服务"""
    
    @staticmethod
    async def create_production_plan(
        tenant_id: int,
        data: ProductionPlanCreate
    ) -> ProductionPlanResponse:
        """创建生产计划"""
        existing = await ProductionPlan.filter(
            tenant_id=tenant_id,
            plan_no=data.plan_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"生产计划编号 {data.plan_no} 已存在")
        
        plan = await ProductionPlan.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProductionPlanResponse.model_validate(plan)
    
    @staticmethod
    async def get_production_plan_by_uuid(
        tenant_id: int,
        plan_uuid: str
    ) -> ProductionPlanResponse:
        """根据UUID获取生产计划"""
        plan = await ProductionPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"生产计划 {plan_uuid} 不存在")
        
        return ProductionPlanResponse.model_validate(plan)
    
    @staticmethod
    async def list_production_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        plan_type: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ProductionPlanResponse]:
        """获取生产计划列表"""
        query = ProductionPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if plan_type:
            query = query.filter(plan_type=plan_type)
        if priority:
            query = query.filter(priority=priority)
        if status:
            query = query.filter(status=status)
        
        plans = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ProductionPlanResponse.model_validate(p) for p in plans]
    
    @staticmethod
    async def update_production_plan(
        tenant_id: int,
        plan_uuid: str,
        data: ProductionPlanUpdate
    ) -> ProductionPlanResponse:
        """更新生产计划"""
        plan = await ProductionPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"生产计划 {plan_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)
        
        await plan.save()
        
        return ProductionPlanResponse.model_validate(plan)
    
    @staticmethod
    async def delete_production_plan(
        tenant_id: int,
        plan_uuid: str
    ) -> None:
        """删除生产计划（软删除）"""
        plan = await ProductionPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"生产计划 {plan_uuid} 不存在")
        
        plan.deleted_at = datetime.utcnow()
        await plan.save()

