"""
运输计划服务模块

提供运输计划的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaitms.models.transport_plan import TransportPlan
from apps.kuaitms.schemas.transport_plan_schemas import (
    TransportPlanCreate, TransportPlanUpdate, TransportPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class TransportPlanService:
    """运输计划服务"""
    
    @staticmethod
    async def create_transport_plan(
        tenant_id: int,
        data: TransportPlanCreate
    ) -> TransportPlanResponse:
        """创建运输计划"""
        existing = await TransportPlan.filter(
            tenant_id=tenant_id,
            plan_no=data.plan_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"运输计划编号 {data.plan_no} 已存在")
        
        plan = await TransportPlan.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return TransportPlanResponse.model_validate(plan)
    
    @staticmethod
    async def get_transport_plan_by_uuid(
        tenant_id: int,
        plan_uuid: str
    ) -> TransportPlanResponse:
        """根据UUID获取运输计划"""
        plan = await TransportPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"运输计划 {plan_uuid} 不存在")
        
        return TransportPlanResponse.model_validate(plan)
    
    @staticmethod
    async def list_transport_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        vehicle_id: Optional[int] = None
    ) -> List[TransportPlanResponse]:
        """获取运输计划列表"""
        query = TransportPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if vehicle_id:
            query = query.filter(vehicle_id=vehicle_id)
        
        plans = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [TransportPlanResponse.model_validate(p) for p in plans]
    
    @staticmethod
    async def update_transport_plan(
        tenant_id: int,
        plan_uuid: str,
        data: TransportPlanUpdate
    ) -> TransportPlanResponse:
        """更新运输计划"""
        plan = await TransportPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"运输计划 {plan_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)
        
        await plan.save()
        
        return TransportPlanResponse.model_validate(plan)
    
    @staticmethod
    async def delete_transport_plan(
        tenant_id: int,
        plan_uuid: str
    ) -> None:
        """删除运输计划（软删除）"""
        plan = await TransportPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"运输计划 {plan_uuid} 不存在")
        
        plan.deleted_at = datetime.utcnow()
        await plan.save()

