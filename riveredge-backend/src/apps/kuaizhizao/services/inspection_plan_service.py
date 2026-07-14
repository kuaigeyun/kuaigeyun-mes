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

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.inspection_plan import InspectionPlan, InspectionPlanStep
from apps.kuaizhizao.services.inspection_plan_list_core import apply_inspection_plan_list_filters
from apps.kuaizhizao.schemas.inspection_plan import (
    InspectionPlanCreate,
    InspectionPlanListEnvelope,
    InspectionPlanUpdate,
    InspectionPlanResponse,
    InspectionPlanListResponse,
    InspectionPlanStepCreate,
    InspectionPlanStepResponse,
)

from apps.kuaizhizao.services.inspection_step_spec import prepare_plan_step_dict, validate_plan_steps_relations
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InspectionPlanService(AppBaseService[InspectionPlan]):
    """质检方案服务类"""

    def __init__(self):
        super().__init__(InspectionPlan)

    @staticmethod
    def _to_list_response(
        plan: InspectionPlan,
        steps: Optional[List[InspectionPlanStep]] = None,
    ) -> InspectionPlanListResponse:
        """列表响应：排除未加载的 ReverseRelation steps，避免 Pydantic 校验失败。"""
        plan_data = plan.__dict__.copy()
        plan_data.pop("steps", None)
        resp = InspectionPlanListResponse.model_construct(**plan_data)
        if steps is not None:
            resp.steps = [InspectionPlanStepResponse.model_validate(s) for s in steps]
        else:
            resp.steps = None
        return resp

    @staticmethod
    def _to_response(plan: InspectionPlan, steps: List[InspectionPlanStep]) -> InspectionPlanResponse:
        """详情/创建/更新响应：勿对 plan.steps 赋值（ReverseRelation 无 setter）。"""
        plan_data = plan.__dict__.copy()
        plan_data.pop("steps", None)
        resp = InspectionPlanResponse.model_construct(**plan_data)
        resp.steps = [InspectionPlanStepResponse.model_validate(s) for s in steps]
        return resp

    @staticmethod
    async def _load_plan_steps(plan: InspectionPlan) -> List[InspectionPlanStep]:
        return await InspectionPlanStep.filter(plan_id=plan.id).order_by("sequence").all()

    async def create_inspection_plan(
        self,
        tenant_id: int,
        plan_data: InspectionPlanCreate,
        created_by: Optional[int] = None,
    ) -> InspectionPlanResponse:
        """创建质检方案（含步骤）"""
        async with in_transaction():
            if not plan_data.plan_code:
                plan_code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="INSPECTION_PLAN_CODE",
                    plan_type=plan_data.plan_type,
                    material_code=plan_data.material_code or "",
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
            if created_by is not None:
                user_info = await self.get_user_info(created_by)
                plan_dict["created_by"] = created_by
                plan_dict["created_by_name"] = user_info["name"]
                plan_dict["updated_by"] = created_by
                plan_dict["updated_by_name"] = user_info["name"]
            plan = await InspectionPlan.create(**plan_dict)

            if plan_data.steps:
                prepared_steps = [
                    prepare_plan_step_dict(step_data.model_dump()) for step_data in plan_data.steps
                ]
                validate_plan_steps_relations(prepared_steps)
                for idx, step_dict in enumerate(prepared_steps):
                    step_dict["sequence"] = step_dict.get("sequence", idx)
                    await InspectionPlanStep.create(
                        plan_id=plan.id,
                        tenant_id=tenant_id,
                        **step_dict,
                    )

            await plan.fetch_related("steps")
            step_rows = await self._load_plan_steps(plan)
            return self._to_response(plan, step_rows)

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

        step_rows = await self._load_plan_steps(plan)
        return self._to_response(plan, step_rows)

    async def list_inspection_plans(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        plan_type: Optional[str] = None,
        material_id: Optional[int] = None,
        operation_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        plan_code: Optional[str] = None,
        plan_name: Optional[str] = None,
        keyword: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        order_by: Optional[str] = None,
        include_steps: bool = False,
    ) -> InspectionPlanListEnvelope:
        """获取质检方案列表"""
        query = InspectionPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if plan_type:
            query = query.filter(plan_type=plan_type)
        if material_id is not None:
            query = query.filter(material_id=material_id)
        if operation_id is not None:
            query = query.filter(Q(operation_id=operation_id) | Q(operation_id__isnull=True))
        if is_active is not None:
            query = query.filter(is_active=is_active)

        query, primary_order, secondary_order = apply_inspection_plan_list_filters(
            query,
            keyword=keyword,
            plan_code=plan_code,
            plan_name=plan_name,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            order_by=order_by,
        )

        total = await query.count()
        plans = await query.order_by(primary_order, secondary_order).offset(skip).limit(limit).all()

        result = []
        for plan in plans:
            if include_steps:
                step_rows = await self._load_plan_steps(plan)
                result.append(self._to_list_response(plan, step_rows))
            else:
                result.append(self._to_list_response(plan))
        return InspectionPlanListEnvelope(items=result, total=total)

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
            if updated_by is not None:
                user_info = await self.get_user_info(updated_by)
                plan.updated_by = updated_by
                plan.updated_by_name = user_info["name"]
            await plan.save()

            if plan_data.steps is not None:
                prepared_steps = [
                    prepare_plan_step_dict(step_data.model_dump()) for step_data in plan_data.steps
                ]
                validate_plan_steps_relations(prepared_steps)
                await InspectionPlanStep.filter(plan_id=plan_id).delete()
                for idx, step_dict in enumerate(prepared_steps):
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
        return [self._to_list_response(p) for p in plans]
