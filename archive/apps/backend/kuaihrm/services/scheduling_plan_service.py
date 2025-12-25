"""
排班计划服务模块

提供排班计划的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.scheduling import SchedulingPlan
from apps.kuaihrm.schemas.scheduling_plan_schemas import (
    SchedulingPlanCreate, SchedulingPlanUpdate, SchedulingPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SchedulingPlanService:
    """排班计划服务"""
    
    @staticmethod
    async def create_scheduling_plan(
        tenant_id: int,
        data: SchedulingPlanCreate
    ) -> SchedulingPlanResponse:
        """创建排班计划"""
        existing = await SchedulingPlan.filter(
            tenant_id=tenant_id,
            plan_no=data.plan_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"计划编号 {data.plan_no} 已存在")
        
        plan = await SchedulingPlan.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SchedulingPlanResponse.model_validate(plan)
    
    @staticmethod
    async def get_scheduling_plan_by_uuid(
        tenant_id: int,
        plan_uuid: str
    ) -> SchedulingPlanResponse:
        """根据UUID获取排班计划"""
        plan = await SchedulingPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"排班计划 {plan_uuid} 不存在")
        
        return SchedulingPlanResponse.model_validate(plan)
    
    @staticmethod
    async def list_scheduling_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        department_id: Optional[int] = None,
        plan_period: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SchedulingPlanResponse]:
        """获取排班计划列表"""
        query = SchedulingPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if department_id:
            query = query.filter(department_id=department_id)
        if plan_period:
            query = query.filter(plan_period=plan_period)
        if status:
            query = query.filter(status=status)
        
        plans = await query.offset(skip).limit(limit).all()
        
        return [SchedulingPlanResponse.model_validate(p) for p in plans]
    
    @staticmethod
    async def update_scheduling_plan(
        tenant_id: int,
        plan_uuid: str,
        data: SchedulingPlanUpdate
    ) -> SchedulingPlanResponse:
        """更新排班计划"""
        plan = await SchedulingPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"排班计划 {plan_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)
        
        await plan.save()
        
        return SchedulingPlanResponse.model_validate(plan)
    
    @staticmethod
    async def delete_scheduling_plan(
        tenant_id: int,
        plan_uuid: str
    ) -> None:
        """删除排班计划（软删除）"""
        plan = await SchedulingPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"排班计划 {plan_uuid} 不存在")
        
        from datetime import datetime
        plan.deleted_at = datetime.now()
        await plan.save()

