"""
生产计划服务模块

提供生产计划相关的业务逻辑处理。
由 DemandComputationService 生成核心数据，本服务负责计划的管理、审核与执行触发。

Author: Luigi Lu
更新日期: 2025-02-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.production_plan import ProductionPlan
from apps.kuaizhizao.models.production_plan_item import ProductionPlanItem
from apps.kuaizhizao.schemas.planning import (
    ProductionPlanResponse, ProductionPlanListResponse,
    ProductionPlanItemResponse,
)

from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError


class ProductionPlanningService(BaseService):
    """生产计划服务"""

    def __init__(self):
        super().__init__(ProductionPlan)

    async def create_production_plan(self, tenant_id: int, plan_data: Any, created_by: int) -> ProductionPlanResponse:
        """手动创建生产计划"""
        async with in_transaction():
            # 1. 生成编码
            plan_code = await self._generate_plan_code(tenant_id, plan_data.plan_type or "MANUAL")
            
            # 2. 创建主表
            plan_dict = plan_data.model_dump(exclude={'items'}) if hasattr(plan_data, 'model_dump') else plan_data
            plan = await ProductionPlan.create(
                **plan_dict,
                plan_code=plan_code,
                tenant_id=tenant_id,
                created_by=created_by,
                updated_by=created_by,
                status="草稿",
                execution_status="未执行"
            )
            
            # 3. 创建明细项
            items_data = plan_data.items if hasattr(plan_data, 'items') else plan_data.get('items', [])
            for item_data in items_data:
                item_dict = item_data.model_dump() if hasattr(item_data, 'model_dump') else item_data
                await ProductionPlanItem.create(
                    **item_dict,
                    plan_id=plan.id,
                    tenant_id=tenant_id
                )
            
            return ProductionPlanResponse.model_validate(plan)

    async def get_production_plan_by_id(self, tenant_id: int, plan_id: int) -> ProductionPlanResponse:
        """根据ID获取生产计划"""
        plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True)
        if not plan:
            raise NotFoundError(f"生产计划不存在: {plan_id}")
        resp = ProductionPlanResponse.model_validate(plan)
        from apps.kuaizhizao.services.document_lifecycle_service import get_production_plan_lifecycle
        resp.lifecycle = get_production_plan_lifecycle(plan)
        return resp

    async def approve_production_plan(
        self, tenant_id: int, plan_id: int, approved_by: int, rejection_reason: Optional[str] = None
    ) -> ProductionPlanResponse:
        """审核生产计划"""
        plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True)
        if not plan:
            raise NotFoundError(f"生产计划不存在: {plan_id}")
        if plan.execution_status == "已执行":
            raise BusinessLogicError("已执行的生产计划不允许审核")

        from apps.base_service import AppBaseService
        reviewer_name = await AppBaseService().get_user_name(approved_by)

        if rejection_reason:
            await ProductionPlan.filter(tenant_id=tenant_id, id=plan_id).update(
                reviewer_id=approved_by,
                reviewer_name=reviewer_name,
                review_time=datetime.now(),
                review_status="驳回",
                review_remarks=rejection_reason,
                status="已驳回",
                updated_by=approved_by
            )
        else:
            await ProductionPlan.filter(tenant_id=tenant_id, id=plan_id).update(
                reviewer_id=approved_by,
                reviewer_name=reviewer_name,
                review_time=datetime.now(),
                review_status="通过",
                review_remarks=None,
                status="已审核",
                updated_by=approved_by
            )

        return await self.get_production_plan_by_id(tenant_id, plan_id)

    async def submit_production_plan(self, tenant_id: int, plan_id: int, submitted_by: int) -> ProductionPlanResponse:
        """提交生产计划审核（已驳回时重新提交）"""
        plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True)
        if not plan:
            raise NotFoundError(f"生产计划不存在: {plan_id}")
        if plan.status != "已驳回":
            raise BusinessLogicError("只有已驳回状态的生产计划才能重新提交")
        if plan.execution_status == "已执行":
            raise BusinessLogicError("已执行的生产计划不允许操作")

        await ProductionPlan.filter(tenant_id=tenant_id, id=plan_id).update(
            status="草稿",
            review_status="待审核",
            review_remarks=None,
            updated_by=submitted_by
        )
        return await self.get_production_plan_by_id(tenant_id, plan_id)

    async def update_production_plan(self, tenant_id: int, plan_id: int, plan_data: Any, updated_by: int) -> ProductionPlanResponse:
        """更新生产计划"""
        plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True)
        if not plan:
            raise NotFoundError(f"生产计划不存在: {plan_id}")
        
        # 仅允许更新非执行状态的计划
        if plan.execution_status == "已执行":
            raise BusinessLogicError("已执行的生产计划不允许修改")

        update_data = plan_data.model_dump(exclude_unset=True) if hasattr(plan_data, 'model_dump') else plan_data
        await plan.update_from_dict(update_data)
        plan.updated_by = updated_by
        await plan.save()
        return ProductionPlanResponse.model_validate(plan)

    async def delete_production_plan(self, tenant_id: int, plan_id: int, updated_by: int):
        """删除生产计划（软删除）"""
        plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True)
        if not plan:
            raise NotFoundError(f"生产计划不存在: {plan_id}")
            
        if plan.execution_status == "已执行":
            raise BusinessLogicError("已执行的生产计划不允许删除")

        plan.deleted_at = datetime.now()
        plan.updated_by = updated_by
        await plan.save()
        return True

    async def list_production_plans(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ProductionPlanListResponse]:
        """获取生产计划列表"""
        query = ProductionPlan.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get('plan_type'):
            query = query.filter(plan_type=filters['plan_type'])
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('plan_code'):
            query = query.filter(plan_code__icontains=filters['plan_code'])

        plans = await query.offset(skip).limit(limit).order_by('-created_at')
        from apps.kuaizhizao.services.document_lifecycle_service import get_production_plan_lifecycle
        result = []
        for plan in plans:
            resp = ProductionPlanListResponse.model_validate(plan)
            resp.lifecycle = get_production_plan_lifecycle(plan)
            result.append(resp)
        return result

    async def get_production_plan_count(self, tenant_id: int, **filters) -> int:
        """获取生产计划总数"""
        query = ProductionPlan.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get('plan_type'):
            query = query.filter(plan_type=filters['plan_type'])
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        return await query.count()

    async def get_production_plan_statistics(self, tenant_id: int) -> Dict[str, Any]:
        """获取生产计划统计信息"""
        base_query = ProductionPlan.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        total_plans = await base_query.count()
        mrp_plans = await base_query.filter(plan_type='MRP').count()
        lrp_plans = await base_query.filter(plan_type='LRP').count()
        executed_plans = await base_query.filter(execution_status='已执行').count()
        pending_execution_plans = await base_query.filter(execution_status='未执行').count()

        return {
            "total_count": total_plans,
            "mrp_count": mrp_plans,
            "lrp_count": lrp_plans,
            "executed_count": executed_plans,
            "pending_execution_count": pending_execution_plans,
        }

    async def get_plan_items(self, tenant_id: int, plan_id: int) -> List[ProductionPlanItemResponse]:
        """获取生产计划明细"""
        items = await ProductionPlanItem.filter(tenant_id=tenant_id, plan_id=plan_id).order_by('planned_date')
        return [ProductionPlanItemResponse.model_validate(item) for item in items]

    async def execute_plan(self, tenant_id: int, plan_id: int, executed_by: int) -> ProductionPlanResponse:
        """
        执行生产计划
        
        一键触发工单和采购单的下推逻辑。
        若配置了计划审核（nodes.production_plan.auditRequired），则仅已审核计划可执行。
        """
        from apps.kuaizhizao.services.document_push_pull_service import DocumentPushPullService
        from infra.services.business_config_service import BusinessConfigService
        
        async with in_transaction():
            plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id)
            if not plan:
                raise NotFoundError(f"生产计划不存在: {plan_id}")

            if plan.execution_status == '已执行':
                raise BusinessLogicError("该生产计划已执行，请勿重复操作")

            # 按配置校验：若开启计划审核，则仅已审核计划可执行
            biz_config = BusinessConfigService()
            audit_required = await biz_config.check_audit_required(tenant_id, "production_plan")
            if audit_required:
                plan_status = getattr(plan, "status", None) or ""
                review_status = getattr(plan, "review_status", None) or ""
                if plan_status != "已审核" and review_status != "已审核":
                    raise BusinessLogicError(
                        "当前配置要求生产计划审核通过后才能执行，请先审核计划。"
                    )

            push_service = DocumentPushPullService()
            
            # 1. 产生工单
            try:
                await push_service.push_document(
                    tenant_id=tenant_id,
                    source_type="production_plan",
                    source_id=plan_id,
                    target_type="work_order",
                    created_by=executed_by
                )
            except BusinessLogicError as e:
                logger.info(f"计划执行产生工单跳过或提示: {e}")

            # 更新计划状态
            plan.execution_status = "已执行"
            plan.updated_by = executed_by
            await plan.save()

            return ProductionPlanResponse.model_validate(plan)

    @staticmethod
    async def _generate_plan_code(tenant_id: int, plan_type: str) -> str:
        """生成生产计划编码"""
        from core.services.business.code_generation_service import CodeGenerationService
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"{plan_type}{today}"
        return await CodeGenerationService.generate_code(tenant_id, f"{plan_type}_PLAN_CODE", {"prefix": prefix})
