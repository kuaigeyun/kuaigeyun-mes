"""
质检方案业务服务模块

提供质检方案相关的业务逻辑处理，包括创建、查询、更新、删除等。

Author: RiverEdge Team
Date: 2026-02-26
"""

import uuid
from datetime import datetime
from typing import List, Optional

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.inspection_plan import InspectionPlan, InspectionPlanStep
from apps.kuaizhizao.schemas.inspection_plan import (
    InspectionPlanCreate,
    InspectionPlanUpdate,
    InspectionPlanResponse,
    InspectionPlanListResponse,
    InspectionPlanStepCreate,
    InspectionPlanStepResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.services.business.code_rule_service import CodeRuleService


class InspectionPlanService(AppBaseService[InspectionPlan]):
    """质检方案服务类"""

    def __init__(self):
        super().__init__(InspectionPlan)

    async def create_inspection_plan(
        self,
        tenant_id: int,
        plan_data: InspectionPlanCreate,
        created_by: Optional[int] = None,
    ) -> InspectionPlanResponse:
        """创建质检方案（含步骤）"""
        async with in_transaction():
            if not plan_data.plan_code:
                code_rule_service = CodeRuleService()
                plan_code = await code_rule_service.generate_code(
                    tenant_id=tenant_id,
                    code_rule_code="INSPECTION_PLAN_CODE",
                    context={
                        "plan_type": plan_data.plan_type,
                        "material_code": plan_data.material_code or "",
                    },
                )
            else:
                plan_code = plan_data.plan_code

            existing = await InspectionPlan.filter(
                tenant_id=tenant_id,
                plan_code=plan_code,
                deleted_at__isnull=True,
            ).first()
            if existing:
                raise ValidationError(f"质检方案编码 '{plan_code}' 已存在")

            plan_dict = plan_data.model_dump(exclude_unset=True, exclude={"steps"})
            plan_dict.update({
                "tenant_id": tenant_id,
                "plan_code": plan_code,
                "uuid": str(uuid.uuid4()),
            })
            plan = await InspectionPlan.create(**plan_dict)

            if plan_data.steps:
                for idx, step_data in enumerate(plan_data.steps):
                    step_dict = step_data.model_dump()
                    step_dict["sequence"] = step_dict.get("sequence", idx)
                    await InspectionPlanStep.create(
                        plan_id=plan.id,
                        tenant_id=tenant_id,
                        **step_dict,
                    )

            await plan.fetch_related("steps")
            plan.steps = await plan.steps.order_by("sequence").all()
            resp = InspectionPlanResponse.model_validate(plan)
            resp.steps = [InspectionPlanStepResponse.model_validate(s) for s in plan.steps]
            return resp

    async def get_inspection_plan_by_id(
        self,
        tenant_id: int,
        plan_id: int,
    ) -> InspectionPlanResponse:
        """根据ID获取质检方案（含步骤）"""
        plan = await InspectionPlan.filter(
            tenant_id=tenant_id,
            id=plan_id,
            deleted_at__isnull=True,
        ).first()

        if not plan:
            raise NotFoundError(f"质检方案 ID {plan_id} 不存在")

        await plan.fetch_related("steps")
        plan.steps = await plan.steps.order_by("sequence").all()
        resp = InspectionPlanResponse.model_validate(plan)
        resp.steps = [InspectionPlanStepResponse.model_validate(s) for s in plan.steps]
        return resp

    async def list_inspection_plans(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        plan_type: Optional[str] = None,
        material_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        plan_code: Optional[str] = None,
        plan_name: Optional[str] = None,
        include_steps: bool = False,
    ) -> List[InspectionPlanListResponse]:
        """获取质检方案列表"""
        query = InspectionPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if plan_type:
            query = query.filter(plan_type=plan_type)
        if material_id is not None:
            query = query.filter(material_id=material_id)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if plan_code:
            query = query.filter(plan_code__icontains=plan_code)
        if plan_name:
            query = query.filter(plan_name__icontains=plan_name)

        plans = await query.order_by("-created_at").offset(skip).limit(limit).all()

        result = []
        for plan in plans:
            if include_steps:
                await plan.fetch_related("steps")
                plan.steps = await plan.steps.order_by("sequence").all()
                resp = InspectionPlanListResponse.model_validate(plan)
                resp.steps = [InspectionPlanStepResponse.model_validate(s) for s in plan.steps]
                result.append(resp)
            else:
                result.append(InspectionPlanListResponse.model_validate(plan))
        return result

    async def update_inspection_plan(
        self,
        tenant_id: int,
        plan_id: int,
        plan_data: InspectionPlanUpdate,
        updated_by: Optional[int] = None,
    ) -> InspectionPlanResponse:
        """更新质检方案（含步骤替换）"""
        async with in_transaction():
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id,
                id=plan_id,
                deleted_at__isnull=True,
            ).first()

            if not plan:
                raise NotFoundError(f"质检方案 ID {plan_id} 不存在")

            update_dict = plan_data.model_dump(exclude_unset=True, exclude={"steps"})
            for key, value in update_dict.items():
                setattr(plan, key, value)
            await plan.save()

            if plan_data.steps is not None:
                await InspectionPlanStep.filter(plan_id=plan_id).delete()
                for idx, step_data in enumerate(plan_data.steps):
                    step_dict = step_data.model_dump()
                    step_dict["sequence"] = step_dict.get("sequence", idx)
                    await InspectionPlanStep.create(
                        plan_id=plan.id,
                        tenant_id=tenant_id,
                        **step_dict,
                    )

            return await self.get_inspection_plan_by_id(tenant_id, plan_id)

    async def delete_inspection_plan(
        self,
        tenant_id: int,
        plan_id: int,
    ) -> None:
        """删除质检方案（软删除）"""
        async with in_transaction():
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id,
                id=plan_id,
                deleted_at__isnull=True,
            ).first()

            if not plan:
                raise NotFoundError(f"质检方案 ID {plan_id} 不存在")

            plan.deleted_at = datetime.now()
            await plan.save()

    async def get_plans_by_material(
        self,
        tenant_id: int,
        material_id: int,
        plan_type: Optional[str] = None,
    ) -> List[InspectionPlanListResponse]:
        """根据物料ID获取适用的质检方案"""
        query = InspectionPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).filter(
            Q(material_id=material_id) | Q(material_id__isnull=True)
        )
        if plan_type:
            query = query.filter(plan_type=plan_type)
        plans = await query.order_by("-material_id", "-created_at").all()
        return [InspectionPlanListResponse.model_validate(p) for p in plans]
