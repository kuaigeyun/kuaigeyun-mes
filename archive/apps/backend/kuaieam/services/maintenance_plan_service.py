"""
维护计划服务模块

提供维护计划的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.maintenance_plan import MaintenancePlan
from apps.kuaieam.schemas.maintenance_plan_schemas import (
    MaintenancePlanCreate, MaintenancePlanUpdate, MaintenancePlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaintenancePlanService:
    """维护计划服务"""
    
    @staticmethod
    async def create_maintenance_plan(
        tenant_id: int,
        data: MaintenancePlanCreate
    ) -> MaintenancePlanResponse:
        """创建维护计划"""
        existing = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            plan_no=data.plan_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"维护计划编号 {data.plan_no} 已存在")
        
        plan = await MaintenancePlan.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MaintenancePlanResponse.model_validate(plan)
    
    @staticmethod
    async def get_maintenance_plan_by_uuid(
        tenant_id: int,
        plan_uuid: str
    ) -> MaintenancePlanResponse:
        """根据UUID获取维护计划"""
        plan = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"维护计划 {plan_uuid} 不存在")
        
        return MaintenancePlanResponse.model_validate(plan)
    
    @staticmethod
    async def list_maintenance_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        plan_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[MaintenancePlanResponse]:
        """获取维护计划列表"""
        query = MaintenancePlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if plan_type:
            query = query.filter(plan_type=plan_type)
        if status:
            query = query.filter(status=status)
        
        plans = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [MaintenancePlanResponse.model_validate(p) for p in plans]
    
    @staticmethod
    async def update_maintenance_plan(
        tenant_id: int,
        plan_uuid: str,
        data: MaintenancePlanUpdate
    ) -> MaintenancePlanResponse:
        """更新维护计划"""
        plan = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"维护计划 {plan_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)
        
        await plan.save()
        
        return MaintenancePlanResponse.model_validate(plan)
    
    @staticmethod
    async def delete_maintenance_plan(
        tenant_id: int,
        plan_uuid: str
    ) -> None:
        """删除维护计划（软删除）"""
        plan = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"维护计划 {plan_uuid} 不存在")
        
        plan.deleted_at = datetime.utcnow()
        await plan.save()
