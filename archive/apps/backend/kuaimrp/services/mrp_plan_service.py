"""
MRP计划服务模块

提供MRP计划的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimrp.models.mrp_plan import MRPPlan
from apps.kuaimrp.schemas.mrp_plan_schemas import (
    MRPPlanCreate, MRPPlanUpdate, MRPPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MRPPlanService:
    """MRP计划服务"""
    
    @staticmethod
    async def create_mrp_plan(
        tenant_id: int,
        data: MRPPlanCreate
    ) -> MRPPlanResponse:
        """
        创建MRP计划
        
        Args:
            tenant_id: 租户ID
            data: 计划创建数据
            
        Returns:
            MRPPlanResponse: 创建的计划对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await MRPPlan.filter(
            tenant_id=tenant_id,
            plan_no=data.plan_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"计划编号 {data.plan_no} 已存在")
        
        # 创建计划
        plan = await MRPPlan.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MRPPlanResponse.model_validate(plan)
    
    @staticmethod
    async def get_mrp_plan_by_uuid(
        tenant_id: int,
        plan_uuid: str
    ) -> MRPPlanResponse:
        """
        根据UUID获取MRP计划
        
        Args:
            tenant_id: 租户ID
            plan_uuid: 计划UUID
            
        Returns:
            MRPPlanResponse: 计划对象
            
        Raises:
            NotFoundError: 当计划不存在时抛出
        """
        plan = await MRPPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"MRP计划 {plan_uuid} 不存在")
        
        return MRPPlanResponse.model_validate(plan)
    
    @staticmethod
    async def list_mrp_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        plan_type: Optional[str] = None
    ) -> List[MRPPlanResponse]:
        """
        获取MRP计划列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 计划状态（过滤）
            plan_type: 计划类型（过滤）
            
        Returns:
            List[MRPPlanResponse]: 计划列表
        """
        query = MRPPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if plan_type:
            query = query.filter(plan_type=plan_type)
        
        plans = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [MRPPlanResponse.model_validate(plan) for plan in plans]
    
    @staticmethod
    async def update_mrp_plan(
        tenant_id: int,
        plan_uuid: str,
        data: MRPPlanUpdate
    ) -> MRPPlanResponse:
        """
        更新MRP计划
        
        Args:
            tenant_id: 租户ID
            plan_uuid: 计划UUID
            data: 计划更新数据
            
        Returns:
            MRPPlanResponse: 更新后的计划对象
            
        Raises:
            NotFoundError: 当计划不存在时抛出
        """
        plan = await MRPPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"MRP计划 {plan_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)
        
        await plan.save()
        
        return MRPPlanResponse.model_validate(plan)
    
    @staticmethod
    async def delete_mrp_plan(
        tenant_id: int,
        plan_uuid: str
    ) -> None:
        """
        删除MRP计划（软删除）
        
        Args:
            tenant_id: 租户ID
            plan_uuid: 计划UUID
            
        Raises:
            NotFoundError: 当计划不存在时抛出
        """
        plan = await MRPPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"MRP计划 {plan_uuid} 不存在")
        
        plan.deleted_at = datetime.utcnow()
        await plan.save()
    
    @staticmethod
    async def calculate_mrp(
        tenant_id: int,
        plan_uuid: str
    ) -> MRPPlanResponse:
        """
        执行MRP计算
        
        Args:
            tenant_id: 租户ID
            plan_uuid: 计划UUID
            
        Returns:
            MRPPlanResponse: 更新后的计划对象
            
        Raises:
            NotFoundError: 当计划不存在时抛出
            ValidationError: 当计划状态不允许计算时抛出
        """
        plan = await MRPPlan.filter(
            tenant_id=tenant_id,
            uuid=plan_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError(f"MRP计划 {plan_uuid} 不存在")
        
        # 检查计划状态
        if plan.status not in ["草稿", "已完成"]:
            raise ValidationError(f"计划状态为 {plan.status}，无法执行计算")
        
        # 更新状态为计算中
        plan.status = "计算中"
        await plan.save()
        
        # TODO: 实现MRP计算逻辑
        # 这里应该调用MRP计算引擎，生成物料需求明细
        
        # 更新计算结果（示例）
        plan.calculation_result = {
            "total_requirements": 0,
            "total_materials": 0,
            "calculation_time": datetime.utcnow().isoformat(),
        }
        plan.status = "已完成"
        await plan.save()
        
        return MRPPlanResponse.model_validate(plan)
