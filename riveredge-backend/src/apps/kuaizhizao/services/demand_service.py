"""
统一需求管理服务模块

提供统一需求管理相关的业务逻辑处理，支持销售预测和销售订单两种需求类型。

根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_item import DemandItem
from apps.kuaizhizao.models.demand_snapshot import DemandSnapshot
from apps.kuaizhizao.models.demand_recalc_history import DemandRecalcHistory
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem

from apps.kuaizhizao.schemas.demand import (
    DemandCreate, DemandUpdate, DemandResponse, DemandListResponse,
    DemandItemCreate, DemandItemUpdate, DemandItemResponse,
)
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, LEGACY_AUDITED_VALUES

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class DemandService(AppBaseService[Demand]):
    """
    统一需求管理服务
    
    提供统一的需求管理功能，支持销售预测和销售订单两种需求类型。
    """

    def __init__(self):
        super().__init__(Demand)

    async def create_demand(
        self, 
        tenant_id: int, 
        demand_data: DemandCreate, 
        created_by: int
    ) -> DemandResponse:
        """
        创建统一需求
        
        Args:
            tenant_id: 租户ID
            demand_data: 需求创建数据
            created_by: 创建人ID
            
        Returns:
            DemandResponse: 创建的需求响应
            
        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取用户信息
            user_info = await self.get_user_info(created_by)
            
            # 生成需求编码
            code = await self._generate_demand_code(
                tenant_id, 
                demand_data.demand_type
            )
            
            # 准备创建数据
            create_data = demand_data.model_dump(
                exclude_unset=True, 
                exclude={'items', 'created_by', 'demand_code'}
            )
            create_data['demand_code'] = code
            create_data['created_by'] = created_by
            create_data['updated_by'] = created_by
            
            # 创建需求
            demand = await Demand.create(
                tenant_id=tenant_id,
                **create_data
            )
            
            # 创建需求明细（如果提供了items）
            items_data = demand_data.items or []
            if items_data:
                total_quantity = Decimal("0")
                total_amount = Decimal("0")
                
                for item_data in items_data:
                    item_dict = item_data.model_dump(exclude_unset=True)
                    
                    # 计算金额（销售订单）
                    if demand_data.demand_type == "sales_order":
                        if item_dict.get('unit_price') and item_dict.get('required_quantity'):
                            item_amount = Decimal(str(item_dict['unit_price'])) * Decimal(str(item_dict['required_quantity']))
                            item_dict['item_amount'] = item_amount
                            total_amount += item_amount
                    
                    # 计算剩余数量（销售订单）
                    if demand_data.demand_type == "sales_order":
                        item_dict['remaining_quantity'] = Decimal(str(item_dict['required_quantity']))
                    
                    total_quantity += Decimal(str(item_dict['required_quantity']))
                    
                    await DemandItem.create(
                        tenant_id=tenant_id,
                        demand_id=demand.id,
                        **item_dict
                    )
                
                # 更新需求总数量和总金额
                await Demand.filter(tenant_id=tenant_id, id=demand.id).update(
                    total_quantity=total_quantity,
                    total_amount=total_amount
                )
                
                # 重新加载需求以获取最新数据
                demand = await Demand.get(tenant_id=tenant_id, id=demand.id)
            
            return DemandResponse.model_validate(demand)

    async def get_demand_by_id(
        self, 
        tenant_id: int, 
        demand_id: int,
        include_items: bool = False,
        include_duration: bool = False
    ) -> DemandResponse:
        """
        根据ID获取需求
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            include_items: 是否包含明细
            include_duration: 是否包含耗时统计
            
        Returns:
            DemandResponse: 需求响应
            
        Raises:
            NotFoundError: 需求不存在
        """
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
        if not demand:
            raise NotFoundError("需求", str(demand_id))
        
        response = DemandResponse.model_validate(demand)
        
        # 展示与上游一致：若需求来自销售订单/销售预测，用上游的 status/review_status 覆盖展示
        if getattr(demand, "source_type", None) == "sales_order" and getattr(demand, "source_id", None):
            order = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=demand.source_id, deleted_at__isnull=True
            )
            if order:
                response.status = order.status
                response.review_status = order.review_status
        elif getattr(demand, "source_type", None) == "sales_forecast" and getattr(demand, "source_id", None):
            forecast = await SalesForecast.get_or_none(
                tenant_id=tenant_id, id=demand.source_id, deleted_at__isnull=True
            )
            if forecast:
                response.status = forecast.status
                response.review_status = forecast.review_status
        
        items = None
        if include_items:
            items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).all()
            response.items = [DemandItemResponse.model_validate(item) for item in items]
        
        # 用覆盖后的 status/review_status 计算 lifecycle，保证与上游展示一致
        from apps.kuaizhizao.services.document_lifecycle_service import get_demand_lifecycle
        demand_for_lifecycle = type("DemandView", (), {
            "status": response.status,
            "review_status": response.review_status,
            "pushed_to_computation": getattr(demand, "pushed_to_computation", False),
        })()
        response.lifecycle = get_demand_lifecycle(demand_for_lifecycle, items=items)
        
        # 如果需要耗时统计
        if include_duration:
            duration_info = {}
            if demand.created_at and demand.submit_time:
                duration_info["draft_to_submit"] = (demand.submit_time - demand.created_at).total_seconds()
            if demand.submit_time and demand.review_time:
                duration_info["submit_to_review"] = (demand.review_time - demand.submit_time).total_seconds()
            response.duration_info = duration_info
            
        return response

    async def list_demands(
        self, 
        tenant_id: int, 
        skip: int = 0, 
        limit: int = 20, 
        **filters
    ) -> Dict[str, Any]:
        """
        获取需求列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            **filters: 过滤条件（demand_type, status, business_mode等）
            
        Returns:
            Dict: 包含data、total、success的字典
        """
        query = Demand.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('demand_type'):
            query = query.filter(demand_type=filters['demand_type'])
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('business_mode'):
            query = query.filter(business_mode=filters['business_mode'])
        if filters.get('review_status'):
            query = query.filter(review_status=filters['review_status'])
        if filters.get('start_date'):
            query = query.filter(start_date__gte=filters['start_date'])
        if filters.get('end_date'):
            query = query.filter(end_date__lte=filters['end_date'])

        # 获取总数
        total = await query.count()
        
        # 获取分页数据
        demands = await query.offset(skip).limit(limit).order_by('-created_at')
        
        # 批量拉取上游单据，保证需求展示与销售订单/销售预测一致
        order_ids = [d.source_id for d in demands if getattr(d, "source_type", None) == "sales_order" and getattr(d, "source_id", None)]
        forecast_ids = [d.source_id for d in demands if getattr(d, "source_type", None) == "sales_forecast" and getattr(d, "source_id", None)]
        order_map = {}
        forecast_map = {}
        if order_ids:
            orders = await SalesOrder.filter(tenant_id=tenant_id, id__in=order_ids, deleted_at__isnull=True).all()
            order_map = {o.id: o for o in orders}
        if forecast_ids:
            forecasts = await SalesForecast.filter(tenant_id=tenant_id, id__in=forecast_ids, deleted_at__isnull=True).all()
            forecast_map = {f.id: f for f in forecasts}
        
        from apps.kuaizhizao.services.document_lifecycle_service import get_demand_lifecycle
        data = []
        for demand in demands:
            item = DemandListResponse.model_validate(demand)
            status, review_status = demand.status, demand.review_status
            if getattr(demand, "source_type", None) == "sales_order" and demand.source_id and demand.source_id in order_map:
                o = order_map[demand.source_id]
                status, review_status = o.status, o.review_status
                item.status = status
                item.review_status = review_status
            elif getattr(demand, "source_type", None) == "sales_forecast" and demand.source_id and demand.source_id in forecast_map:
                f = forecast_map[demand.source_id]
                status, review_status = f.status, f.review_status
                item.status = status
                item.review_status = review_status
            demand_view = type("DemandView", (), {"status": status, "review_status": review_status, "pushed_to_computation": getattr(demand, "pushed_to_computation", False)})()
            item.lifecycle = get_demand_lifecycle(demand_view, items=None)
            data.append(item.model_dump())
        
        return {
            "data": data,
            "total": total,
            "success": True
        }

    async def update_demand(
        self, 
        tenant_id: int, 
        demand_id: int, 
        demand_data: DemandUpdate, 
        updated_by: int
    ) -> DemandResponse:
        """
        更新需求
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            demand_data: 需求更新数据
            updated_by: 更新人ID
            
        Returns:
            DemandResponse: 更新后的需求响应
            
        Raises:
            NotFoundError: 需求不存在
            BusinessLogicError: 需求状态不允许更新
        """
        async with in_transaction():
            # 验证需求存在
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
            if not demand:
                raise NotFoundError("需求", str(demand_id))
            
            # 只能更新草稿状态的需求
            if demand.status != DemandStatus.DRAFT:
                raise BusinessLogicError(f"只能更新草稿状态的需求，当前状态: {demand.status}")
            
            # 准备更新数据
            update_data = demand_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by
            
            # 更新需求
            await Demand.filter(tenant_id=tenant_id, id=demand_id).update(**update_data)
            
            # 返回更新后的需求
            return await self.get_demand_by_id(tenant_id, demand_id)

    async def submit_demand(
        self, 
        tenant_id: int, 
        demand_id: int, 
        submitted_by: int
    ) -> DemandResponse:
        """
        提交需求（提交审核）
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            submitted_by: 提交人ID
            
        Returns:
            DemandResponse: 提交后的需求响应
            
        Raises:
            NotFoundError: 需求不存在
            BusinessLogicError: 需求状态不允许提交
        """
        async with in_transaction():
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
            if not demand:
                raise NotFoundError("需求", str(demand_id))
            
            # 只能提交草稿状态的需求
            if demand.status != DemandStatus.DRAFT:
                raise BusinessLogicError(f"只能提交草稿状态的需求，当前状态: {demand.status}")
            
            # 使用状态流转服务更新状态
            try:
                from apps.kuaizhizao.services.state_transition_service import StateTransitionService
                state_service = StateTransitionService()
                submitter_name = await self.get_user_name(submitted_by)
                
                await state_service.transition_state(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id,
                    from_state=demand.status,
                    to_state=DemandStatus.PENDING_REVIEW,
                    operator_id=submitted_by,
                    operator_name=submitter_name,
                    transition_reason="提交审核"
                )
            except Exception as e:
                logger.warning(f"状态流转失败: {e}，使用直接更新方式")
            
            # 更新状态为待审核，记录提交时间
            await Demand.filter(tenant_id=tenant_id, id=demand_id).update(
                status=DemandStatus.PENDING_REVIEW,
                review_status=ReviewStatus.PENDING,
                submit_time=datetime.now(),
                updated_by=submitted_by
            )
            
            # 启动审核流程（统一使用 ApprovalInstanceService）
            try:
                from core.services.approval.approval_instance_service import ApprovalInstanceService
                instance = await ApprovalInstanceService.start_approval(
                    tenant_id=tenant_id,
                    user_id=submitted_by,
                    process_code="demand_approval",
                    entity_type="demand",
                    entity_id=demand_id,
                    entity_uuid=str(demand.uuid),
                    title=f"需求审批: {demand.demand_code}",
                    content=f"需求类型: {demand.demand_type or '-'}, 业务模式: {demand.business_mode or '-'}",
                )
                if instance:
                    logger.info(f"需求 {demand.demand_code} 已启动审核流程")
                else:
                    logger.info(f"需求 {demand.demand_code} 未配置审核流程，使用简单审核模式")
            except Exception as e:
                logger.warning(f"启动审核流程失败: {e}，继续使用简单审核模式")
            
            return await self.get_demand_by_id(tenant_id, demand_id)

    async def approve_demand(
        self, 
        tenant_id: int, 
        demand_id: int, 
        approved_by: int, 
        rejection_reason: Optional[str] = None
    ) -> DemandResponse:
        """
        审核需求
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            approved_by: 审核人ID
            rejection_reason: 驳回原因（如果驳回）
            
        Returns:
            DemandResponse: 审核后的需求响应
            
        Raises:
            NotFoundError: 需求不存在
            BusinessLogicError: 需求状态不允许审核
        """
        async with in_transaction():
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
            if not demand:
                raise NotFoundError("需求", str(demand_id))
            
            # 只能审核待审核状态的需求
            if demand.review_status != ReviewStatus.PENDING:
                raise BusinessLogicError(f"只能审核待审核状态的需求，当前审核状态: {demand.review_status}")
            
            # 获取审核人信息
            approver_name = await self.get_user_name(approved_by)
            
            # 使用统一审批服务执行审核
            try:
                from core.services.approval.approval_instance_service import ApprovalInstanceService
                approval_status = await ApprovalInstanceService.get_approval_status(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id,
                )
                if approval_status.get("has_flow"):
                    result = await ApprovalInstanceService.execute_approval(
                        tenant_id=tenant_id,
                        entity_type="demand",
                        entity_id=demand_id,
                        approver_id=approved_by,
                        approved=not bool(rejection_reason),
                        comment=rejection_reason,
                    )
                    if result.get("flow_rejected"):
                        review_status = ReviewStatus.REJECTED
                        status = DemandStatus.REJECTED
                    elif result.get("flow_completed"):
                        review_status = ReviewStatus.APPROVED
                        status = DemandStatus.AUDITED
                    else:
                        review_status = ReviewStatus.PENDING
                        status = DemandStatus.PENDING_REVIEW
                else:
                    review_status = ReviewStatus.REJECTED if rejection_reason else ReviewStatus.APPROVED
                    status = DemandStatus.REJECTED if rejection_reason else DemandStatus.AUDITED
            except Exception as e:
                logger.warning(f"使用审批服务失败: {e}，回退到简单审核模式")
                review_status = ReviewStatus.REJECTED if rejection_reason else ReviewStatus.APPROVED
                status = DemandStatus.REJECTED if rejection_reason else DemandStatus.AUDITED
            
            # 使用状态流转服务更新状态
            try:
                from apps.kuaizhizao.services.state_transition_service import StateTransitionService
                state_service = StateTransitionService()
                
                await state_service.transition_state(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id,
                    from_state=demand.status,
                    to_state=status,
                    operator_id=approved_by,
                    operator_name=approver_name,
                    transition_reason="审核" + ("通过" if not rejection_reason else "驳回"),
                    transition_comment=rejection_reason
                )
            except Exception as e:
                logger.warning(f"状态流转失败: {e}，使用直接更新方式")
            
            # 更新审核信息
            await Demand.filter(tenant_id=tenant_id, id=demand_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )
            
            return await self.get_demand_by_id(tenant_id, demand_id)

    async def withdraw_from_computation(
        self,
        tenant_id: int,
        demand_id: int
    ) -> DemandResponse:
        """
        撤回需求计算

        将已下推到需求计算的需求撤回，清除计算记录及关联。仅当需求计算尚未下推工单/采购单等下游单据时允许撤回。

        Args:
            tenant_id: 租户ID
            demand_id: 需求ID

        Returns:
            DemandResponse: 撤回后的需求响应

        Raises:
            NotFoundError: 需求不存在
            BusinessLogicError: 需求状态不允许撤回或已有下游单据
        """
        from apps.kuaizhizao.models.demand_computation import DemandComputation
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        DOWNSTREAM_TYPES = ("work_order", "purchase_order", "purchase_requisition", "production_plan")

        async with in_transaction():
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
            if not demand:
                raise NotFoundError("需求", str(demand_id))

            if demand.status not in (DemandStatus.AUDITED,) + LEGACY_AUDITED_VALUES:
                raise BusinessLogicError(f"只能撤回已审核状态的需求计算，当前状态: {demand.status}")

            if not demand.pushed_to_computation:
                return await self.get_demand_by_id(tenant_id, demand_id)

            computation = None
            if demand.computation_id:
                computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=demand.computation_id)
            if not computation:
                computation = await DemandComputation.filter(tenant_id=tenant_id, demand_id=demand_id).first()
            if not computation:
                all_computations = await DemandComputation.filter(tenant_id=tenant_id).all()
                for c in all_computations:
                    if c.demand_ids and demand_id in c.demand_ids:
                        computation = c
                        break

            if computation:
                has_downstream = await DocumentRelation.filter(
                    tenant_id=tenant_id,
                    source_type="demand_computation",
                    source_id=computation.id,
                    target_type__in=DOWNSTREAM_TYPES
                ).exists()

                if has_downstream:
                    raise BusinessLogicError(
                        "需求计算已下推工单/采购单等，无法撤回。请先处理下游单据。"
                    )

                demand_ids_in_comp = computation.demand_ids if computation.demand_ids else [computation.demand_id]
                if len(demand_ids_in_comp) > 1:
                    # 合并计算：无下游时作废整个计算，清除所有参与需求的计算关联
                    logger.info("合并计算 %s 无下游，作废整单计算（含 %s 个需求）", computation.id, len(demand_ids_in_comp))
                else:
                    # 单需求：仅删除本需求与计算的关联
                    pass

                await DemandComputationItem.filter(
                    tenant_id=tenant_id,
                    computation_id=computation.id
                ).delete()
                await DemandComputation.filter(tenant_id=tenant_id, id=computation.id).delete()
                for rel_demand_id in demand_ids_in_comp:
                    await DocumentRelation.filter(
                        tenant_id=tenant_id,
                        source_type="demand",
                        source_id=rel_demand_id,
                        target_type="demand_computation",
                        target_id=computation.id
                    ).delete()
                    await DocumentRelation.filter(
                        tenant_id=tenant_id,
                        source_type="demand_computation",
                        source_id=computation.id,
                        target_type="demand",
                        target_id=rel_demand_id
                    ).delete()
                    await Demand.filter(tenant_id=tenant_id, id=rel_demand_id).update(
                        pushed_to_computation=False,
                        computation_id=None,
                        computation_code=None,
                        updated_at=datetime.now()
                    )
            else:
                await Demand.filter(tenant_id=tenant_id, id=demand_id).update(
                    pushed_to_computation=False,
                    computation_id=None,
                    computation_code=None,
                    updated_at=datetime.now()
                )

            logger.info(f"需求 {demand_id} 已撤回需求计算")
            return await self.get_demand_by_id(tenant_id, demand_id)

    async def unapprove_demand(
        self, 
        tenant_id: int, 
        demand_id: int, 
        unapproved_by: int
    ) -> DemandResponse:
        """
        撤销审核需求
        
        只有“已审核”或“已驳回”状态的需求可以撤销审核。撤销审核后状态恢复为“待审核”。
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            unapproved_by: 操作人ID
            
        Returns:
            DemandResponse: 撤销审核后的需求响应
            
        Raises:
            NotFoundError: 需求不存在
            BusinessLogicError: 需求状态不允许撤销审核
        """
        async with in_transaction():
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
            if not demand:
                raise NotFoundError("需求", str(demand_id))
            
            # 只能撤销审核已审核或已驳回状态的需求
            if demand.status not in [DemandStatus.AUDITED, DemandStatus.REJECTED]:
                raise BusinessLogicError(f"只能撤销审核已审核或已驳回状态的需求，当前状态: {demand.status}")

            # 若已下推计算，先尝试撤回计算（无下游时自动撤回）
            if demand.pushed_to_computation:
                try:
                    await self.withdraw_from_computation(tenant_id=tenant_id, demand_id=demand_id)
                    demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
                except BusinessLogicError:
                    raise

            # 使用状态流转服务记录
            try:
                from apps.kuaizhizao.services.state_transition_service import StateTransitionService
                state_service = StateTransitionService()
                operator_name = await self.get_user_name(unapproved_by)
                
                await state_service.transition_state(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id,
                    from_state=demand.status,
                    to_state=DemandStatus.PENDING_REVIEW,
                    operator_id=unapproved_by,
                    operator_name=operator_name,
                    transition_reason="撤销审核"
                )
            except Exception as e:
                logger.warning(f"发送状态流转失败: {e}")
            
            # 更新状态为待审核，重置审核信息
            await Demand.filter(tenant_id=tenant_id, id=demand_id).update(
                status=DemandStatus.PENDING_REVIEW,
                review_status=ReviewStatus.PENDING,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=unapproved_by,
                updated_at=datetime.now()
            )
            
            return await self.get_demand_by_id(tenant_id, demand_id)

    async def _generate_demand_code(
        self, 
        tenant_id: int, 
        demand_type: str
    ) -> str:
        """
        生成需求编码
        
        编码规则：
        - 销售预测：SF-YYYYMMDD-序号（如：SF-20250114-001）
        - 销售订单：SO-YYYYMMDD-序号（如：SO-20250114-001）
        
        Args:
            tenant_id: 租户ID
            demand_type: 需求类型（sales_forecast 或 sales_order）
            
        Returns:
            str: 生成的需求编码
        """
        today = datetime.now().strftime("%Y%m%d")
        
        # 根据需求类型确定前缀（与 code_rule_pages 中 kuaizhizao-sales-order/forecast 的 rule_code 一致）
        if demand_type == "sales_forecast":
            prefix = f"SF-{today}"
            code_key = "SALES_FORECAST_CODE"
        elif demand_type == "sales_order":
            prefix = f"SO-{today}"
            code_key = "SALES_ORDER_CODE"
        else:
            raise ValidationError(f"无效的需求类型: {demand_type}")
        
        # 生成编码（规则不存在时使用备用格式）
        try:
            code = await self.generate_code(tenant_id, code_key, prefix=prefix)
            return code
        except ValidationError as e:
            logger.warning(f"编码规则 {code_key} 不可用，使用备用格式: {e}")
            import uuid
            suffix = uuid.uuid4().hex[:6].upper()
            return f"{prefix}-{suffix}"

    async def add_demand_item(
        self, 
        tenant_id: int, 
        demand_id: int, 
        item_data: DemandItemCreate
    ) -> DemandItemResponse:
        """
        添加需求明细
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            item_data: 明细创建数据
            
        Returns:
            DemandItemResponse: 创建的明细响应
            
        Raises:
            NotFoundError: 需求不存在
        """
        async with in_transaction():
            # 验证需求存在
            await self.get_demand_by_id(tenant_id, demand_id)
            
            # 创建明细
            item_dict = item_data.model_dump(exclude_unset=True)
            
            # 如果是销售订单，计算金额和剩余数量
            demand = await Demand.get(tenant_id=tenant_id, id=demand_id)
            if demand.demand_type == "sales_order":
                if item_dict.get('unit_price') and item_dict.get('required_quantity'):
                    item_amount = Decimal(str(item_dict['unit_price'])) * Decimal(str(item_dict['required_quantity']))
                    item_dict['item_amount'] = item_amount
                item_dict['remaining_quantity'] = Decimal(str(item_dict['required_quantity']))
            
            item = await DemandItem.create(
                tenant_id=tenant_id,
                demand_id=demand_id,
                **item_dict
            )
            
            # 更新需求总数量和总金额
            await self._update_demand_totals(tenant_id, demand_id)
            
            return DemandItemResponse.model_validate(item)

    async def update_demand_item(
        self, 
        tenant_id: int, 
        demand_id: int, 
        item_id: int, 
        item_data: DemandItemUpdate
    ) -> DemandItemResponse:
        """
        更新需求明细
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            item_id: 明细ID
            item_data: 明细更新数据
            
        Returns:
            DemandItemResponse: 更新后的明细响应
            
        Raises:
            NotFoundError: 需求或明细不存在
        """
        async with in_transaction():
            # 验证需求存在
            await self.get_demand_by_id(tenant_id, demand_id)
            
            # 验证明细存在
            item = await DemandItem.get_or_none(
                tenant_id=tenant_id,
                demand_id=demand_id,
                id=item_id
            )
            if not item:
                raise NotFoundError("需求明细", str(item_id))
            
            # 更新明细
            update_data = item_data.model_dump(exclude_unset=True)
            
            # 如果是销售订单，重新计算金额
            demand = await Demand.get(tenant_id=tenant_id, id=demand_id)
            if demand.demand_type == "sales_order":
                if update_data.get('unit_price') and update_data.get('required_quantity'):
                    item_amount = Decimal(str(update_data['unit_price'])) * Decimal(str(update_data['required_quantity']))
                    update_data['item_amount'] = item_amount
                if update_data.get('required_quantity'):
                    update_data['remaining_quantity'] = Decimal(str(update_data['required_quantity']))
            
            await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id,
                id=item_id
            ).update(**update_data)
            
            # 更新需求总数量和总金额
            await self._update_demand_totals(tenant_id, demand_id)
            
            # 返回更新后的明细
            updated_item = await DemandItem.get(
                tenant_id=tenant_id,
                demand_id=demand_id,
                id=item_id
            )
            return DemandItemResponse.model_validate(updated_item)

    async def delete_demand_item(
        self, 
        tenant_id: int, 
        demand_id: int, 
        item_id: int
    ) -> None:
        """
        删除需求明细
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            item_id: 明细ID
            
        Raises:
            NotFoundError: 需求或明细不存在
        """
        async with in_transaction():
            # 验证需求存在
            await self.get_demand_by_id(tenant_id, demand_id)
            
            # 验证明细存在
            item = await DemandItem.get_or_none(
                tenant_id=tenant_id,
                demand_id=demand_id,
                id=item_id
            )
            if not item:
                raise NotFoundError("需求明细", str(item_id))
            
            # 删除明细
            await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id,
                id=item_id
            ).delete()
            
            # 更新需求总数量和总金额
            await self._update_demand_totals(tenant_id, demand_id)

    async def delete_demand(
        self,
        tenant_id: int,
        demand_id: int
    ) -> None:
        """
        删除需求
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            
        Raises:
            NotFoundError: 需求不存在
            BusinessLogicError: 需求状态不允许删除
        """
        async with in_transaction():
            logger.info(f"DEBUG: delete_demand call with demand_id={demand_id} (type={type(demand_id)}), tenant_id={tenant_id}")
            logger.info(f"DEBUG: Demand model table name: {Demand._meta.db_table}")
            
            # 查询时需要排除已软删除的记录
            demand = await Demand.get_or_none(id=demand_id, deleted_at__isnull=True)
            
            if not demand:
                # 再次尝试通过 filter 查找，看看是不是 get_or_none 的问题
                filter_res = await Demand.filter(id=demand_id).first()
                logger.info(f"DEBUG: get_or_none failed. filter(...).first() result: {filter_res}")
                
                # 打印所有存在的ID（仅调试用，生产环境慎用，但在当前问题场景下需要）
                all_ids = await Demand.all().values_list('id', flat=True)
                logger.info(f"DEBUG: All existing demand IDs in DB: {all_ids[:20]}... (Total: {len(all_ids)})")
                
                # 尝试查询特定租户的所有记录
                tenant_demands = await Demand.filter(tenant_id=tenant_id).values_list('id', flat=True)
                logger.info(f"DEBUG: Demand IDs for tenant_id={tenant_id}: {tenant_demands[:20]}... (Total: {len(tenant_demands)})")
                
                # 尝试原始SQL查询来验证
                from tortoise import Tortoise
                conn = Tortoise.get_connection("default")
                raw_result = await conn.execute_query_dict(f"SELECT id FROM {Demand._meta.db_table} WHERE id = {demand_id}")
                logger.info(f"DEBUG: Raw SQL query result for id={demand_id}: {raw_result}")
                
                raise NotFoundError("需求", str(demand_id))
            
            if demand.tenant_id != tenant_id:
                logger.warning(f"删除需求失败：租户ID不匹配。请求租户ID: {tenant_id}, 需求ID: {demand_id}, 需求所属租户ID: {demand.tenant_id}")
                raise NotFoundError("需求", str(demand_id))
            
            # 只能删除草稿或待审核状态的需求
            deletable = (
                demand.status == DemandStatus.DRAFT
                or demand.status in (DemandStatus.PENDING_REVIEW, "PENDING_REVIEW", "PENDING", "待审核", "已提交")
            )
            if not deletable:
                raise BusinessLogicError(f"只能删除草稿或待审核状态的需求，当前状态: {demand.status}")
            
            # 删除需求明细
            await DemandItem.filter(tenant_id=tenant_id, demand_id=demand_id).delete()
            
            # 删除需求
            await Demand.filter(tenant_id=tenant_id, id=demand_id).delete()

    async def bulk_delete_demands(
        self,
        tenant_id: int,
        demand_ids: List[int]
    ) -> Dict[str, Any]:
        """
        批量删除需求
        
        Args:
            tenant_id: 租户ID
            demand_ids: 需求ID列表
            
        Returns:
            Dict: 删除结果，包含成功数量和失败详情
        """
        success_count = 0
        failed_items = []
        
        for demand_id in demand_ids:
            try:
                await self.delete_demand(tenant_id, demand_id)
                success_count += 1
            except Exception as e:
                failed_items.append({
                    "id": demand_id,
                    "reason": str(e)
                })
        
        return {
            "success_count": success_count,
            "failed_count": len(failed_items),
            "failed_items": failed_items
        }

    async def inspect_orphan_demands(self, tenant_id: int) -> Dict[str, Any]:
        """
        巡检孤儿需求：统计当前租户的销售订单数、销售预测数、需求数，并列出来源已不存在的需求（孤儿）ID。
        仅查询不修改，用于确认数据后再决定是否调用 clean_orphan_demands。

        Returns:
            Dict: sales_order_count, sales_forecast_count, demand_count, orphan_demand_ids, orphan_count
        """
        sales_order_count = await SalesOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).count()
        sales_forecast_count = await SalesForecast.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).count()
        demand_count = await Demand.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).count()

        candidates = await Demand.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            source_type__in=["sales_order", "sales_forecast"],
        ).exclude(source_id=None).values_list("id", "source_type", "source_id")

        order_source_ids = [s_id for _id, st, s_id in candidates if st == "sales_order" and s_id]
        forecast_source_ids = [s_id for _id, st, s_id in candidates if st == "sales_forecast" and s_id]

        existing_order_ids = set()
        if order_source_ids:
            existing_order_ids = set(
                await SalesOrder.filter(
                    tenant_id=tenant_id,
                    id__in=order_source_ids,
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
            )
        existing_forecast_ids = set()
        if forecast_source_ids:
            existing_forecast_ids = set(
                await SalesForecast.filter(
                    tenant_id=tenant_id,
                    id__in=forecast_source_ids,
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
            )

        orphan_ids = []
        for demand_id, source_type, source_id in candidates:
            if not source_id:
                continue
            if source_type == "sales_order" and source_id not in existing_order_ids:
                orphan_ids.append(demand_id)
            elif source_type == "sales_forecast" and source_id not in existing_forecast_ids:
                orphan_ids.append(demand_id)

        return {
            "tenant_id": tenant_id,
            "sales_order_count": sales_order_count,
            "sales_forecast_count": sales_forecast_count,
            "demand_count": demand_count,
            "orphan_demand_ids": orphan_ids,
            "orphan_count": len(orphan_ids),
        }

    async def clean_orphan_demands(self, tenant_id: int) -> Dict[str, Any]:
        """
        清理孤儿需求：来源单据（销售订单或销售预测）已被删除、但需求记录仍存在的需求。
        直接物理删除（先删明细再删需求），不从库中保留。

        Args:
            tenant_id: 租户ID

        Returns:
            Dict: {"cleaned_count": 清理数量, "demand_ids": 被清理的需求ID列表}
        """
        # 未删除且有关联来源的需求（销售订单或销售预测）
        candidates = await Demand.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            source_type__in=["sales_order", "sales_forecast"],
        ).exclude(source_id=None).values_list("id", "source_type", "source_id")

        if not candidates:
            return {"cleaned_count": 0, "demand_ids": []}

        order_source_ids = [s_id for _id, st, s_id in candidates if st == "sales_order" and s_id]
        forecast_source_ids = [s_id for _id, st, s_id in candidates if st == "sales_forecast" and s_id]

        existing_order_ids = set()
        if order_source_ids:
            existing_order_ids = set(
                await SalesOrder.filter(
                    tenant_id=tenant_id,
                    id__in=order_source_ids,
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
            )
        existing_forecast_ids = set()
        if forecast_source_ids:
            existing_forecast_ids = set(
                await SalesForecast.filter(
                    tenant_id=tenant_id,
                    id__in=forecast_source_ids,
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
            )

        orphan_ids = []
        for demand_id, source_type, source_id in candidates:
            if not source_id:
                continue
            if source_type == "sales_order" and source_id not in existing_order_ids:
                orphan_ids.append(demand_id)
            elif source_type == "sales_forecast" and source_id not in existing_forecast_ids:
                orphan_ids.append(demand_id)

        if not orphan_ids:
            return {"cleaned_count": 0, "demand_ids": []}

        async with in_transaction():
            await DemandItem.filter(tenant_id=tenant_id, demand_id__in=orphan_ids).delete()
            await Demand.filter(tenant_id=tenant_id, id__in=orphan_ids).delete()
        logger.info("清理孤儿需求(直接删除): tenant_id=%s, 数量=%s, demand_ids=%s", tenant_id, len(orphan_ids), orphan_ids)
        return {"cleaned_count": len(orphan_ids), "demand_ids": orphan_ids}

    async def _update_demand_totals(
        self, 
        tenant_id: int, 
        demand_id: int
    ) -> None:
        """
        更新需求总数量和总金额
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
        """
        # 获取所有明细
        items = await DemandItem.filter(
            tenant_id=tenant_id,
            demand_id=demand_id
        ).all()
        
        # 计算总数量和总金额
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        
        for item in items:
            total_quantity += Decimal(str(item.required_quantity))
            if item.item_amount:
                total_amount += Decimal(str(item.item_amount))
        
        # 更新需求
        await Demand.filter(tenant_id=tenant_id, id=demand_id).update(
            total_quantity=total_quantity,
            total_amount=total_amount
        )

    async def sync_from_upstream(
        self,
        tenant_id: int,
        source_type: str,
        source_id: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        """
        根据上游单据（销售订单/销售预测）同步并重算关联需求。
        写需求快照与重算历史；若需求已下推计算则仅标记并触发下游重算提醒（策略 A）。
        """
        demand = await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type=source_type,
            source_id=source_id,
            deleted_at__isnull=True,
        )
        if not demand:
            return {"synced": False, "reason": "no_demand"}

        trigger_reason = f"upstream_{source_type}_updated"
        had_pushed = demand.pushed_to_computation
        computation_id = demand.computation_id
        computation_code = demand.computation_code or ""
        snapshot_id_saved: Optional[int] = None

        try:
            async with in_transaction():
                # 1. 快照：当前需求 + 明细
                items_before = await DemandItem.filter(
                    tenant_id=tenant_id, demand_id=demand.id
                ).all()
                demand_snapshot_json = self._demand_to_snapshot_dict(demand)
                items_snapshot_json = [self._demand_item_to_snapshot_dict(i) for i in items_before]
                snapshot = await DemandSnapshot.create(
                    tenant_id=tenant_id,
                    demand_id=demand.id,
                    snapshot_type="before_recalc",
                    snapshot_at=datetime.now(),
                    demand_snapshot=demand_snapshot_json,
                    demand_items_snapshot=items_snapshot_json,
                    trigger_reason=trigger_reason,
                )
                snapshot_id_saved = snapshot.id

                # 2. 从上游覆盖需求与明细
                if source_type == "sales_order":
                    order = await SalesOrder.get_or_none(
                        tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
                    )
                    if not order:
                        raise NotFoundError("销售订单", str(source_id))
                    order_items = await SalesOrderItem.filter(
                        tenant_id=tenant_id, sales_order_id=source_id
                    ).order_by("id")
                    if not order_items:
                        raise BusinessLogicError("销售订单无明细，无法同步需求")
                    total_qty = sum(Decimal(str(it.order_quantity)) for it in order_items)
                    total_amt = sum(Decimal(str(it.total_amount)) for it in order_items)
                    upd = {
                        "demand_code": order.order_code,
                        "demand_name": order.order_code,
                        "start_date": order.order_date,
                        "end_date": order.delivery_date,
                        "order_date": order.order_date,
                        "delivery_date": order.delivery_date,
                        "customer_id": order.customer_id,
                        "customer_name": order.customer_name,
                        "customer_contact": order.customer_contact,
                        "customer_phone": order.customer_phone,
                        "total_quantity": total_qty,
                        "total_amount": total_amt,
                        "status": order.status,
                        "review_status": order.review_status,
                        "reviewer_id": order.reviewer_id,
                        "reviewer_name": order.reviewer_name,
                        "review_time": order.review_time,
                        "salesman_id": order.salesman_id,
                        "salesman_name": order.salesman_name,
                        "shipping_address": order.shipping_address,
                        "shipping_method": order.shipping_method,
                        "payment_terms": order.payment_terms,
                        "notes": order.notes,
                        "source_code": order.order_code,
                        "updated_by": operator_id,
                    }
                    await Demand.filter(tenant_id=tenant_id, id=demand.id).update(**upd)
                    await DemandItem.filter(tenant_id=tenant_id, demand_id=demand.id).delete()
                    for it in order_items:
                        await DemandItem.create(
                            tenant_id=tenant_id,
                            demand_id=demand.id,
                            material_id=it.material_id,
                            material_code=it.material_code,
                            material_name=it.material_name,
                            material_spec=it.material_spec,
                            material_unit=it.material_unit,
                            required_quantity=it.order_quantity,
                            delivery_date=it.delivery_date,
                            unit_price=it.unit_price,
                            item_amount=it.total_amount,
                            remaining_quantity=it.order_quantity,
                            delivery_status=it.delivery_status or "待交货",
                        )
                elif source_type == "sales_forecast":
                    forecast = await SalesForecast.get_or_none(
                        tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
                    )
                    if not forecast:
                        raise NotFoundError("销售预测", str(source_id))
                    forecast_items = await SalesForecastItem.filter(
                        tenant_id=tenant_id, forecast_id=source_id
                    ).order_by("id")
                    if not forecast_items:
                        raise BusinessLogicError("销售预测无明细，无法同步需求")
                    total_qty = sum(Decimal(str(it.forecast_quantity)) for it in forecast_items)
                    upd = {
                        "demand_code": forecast.forecast_code,
                        "demand_name": forecast.forecast_name or forecast.forecast_code,
                        "start_date": forecast.start_date,
                        "end_date": forecast.end_date,
                        "forecast_period": forecast.forecast_period,
                        "total_quantity": total_qty,
                        "total_amount": Decimal("0"),
                        "status": forecast.status,
                        "review_status": forecast.review_status,
                        "reviewer_id": forecast.reviewer_id,
                        "reviewer_name": forecast.reviewer_name,
                        "review_time": forecast.review_time,
                        "updated_by": operator_id,
                    }
                    await Demand.filter(tenant_id=tenant_id, id=demand.id).update(**upd)
                    await DemandItem.filter(tenant_id=tenant_id, demand_id=demand.id).delete()
                    for it in forecast_items:
                        await DemandItem.create(
                            tenant_id=tenant_id,
                            demand_id=demand.id,
                            material_id=it.material_id,
                            material_code=it.material_code,
                            material_name=it.material_name,
                            material_spec=it.material_spec,
                            material_unit=it.material_unit,
                            required_quantity=it.forecast_quantity,
                            forecast_date=it.forecast_date,
                            remaining_quantity=it.forecast_quantity,
                            delivered_quantity=Decimal("0"),
                            delivery_status="待交货",
                        )
                else:
                    raise ValidationError(f"不支持的上游类型: {source_type}")

                # 3. 重算历史
                await DemandRecalcHistory.create(
                    tenant_id=tenant_id,
                    demand_id=demand.id,
                    recalc_at=datetime.now(),
                    trigger_type="upstream_change",
                    source_type=source_type,
                    source_id=source_id,
                    trigger_reason=trigger_reason,
                    snapshot_id=snapshot.id,
                    operator_id=operator_id,
                    result="success",
                    message=f"已从{source_type}同步",
                )
            # 4. 策略 A：已下推计算则仅通知下游重算（不自动执行需求计算重算）
            if had_pushed and computation_id:
                await self._notify_downstream_recalc(
                    tenant_id=tenant_id,
                    demand_id=demand.id,
                    demand_code=demand.demand_code,
                    computation_id=computation_id,
                    computation_code=computation_code,
                    operator_id=operator_id,
                )
            return {
                "synced": True,
                "demand_id": demand.id,
                "demand_code": demand.demand_code,
                "notified_downstream": had_pushed,
            }
        except Exception as e:
            logger.exception("需求同步上游失败: %s", e)
            await DemandRecalcHistory.create(
                tenant_id=tenant_id,
                demand_id=demand.id,
                recalc_at=datetime.now(),
                trigger_type="upstream_change",
                source_type=source_type,
                source_id=source_id,
                trigger_reason=trigger_reason,
                snapshot_id=snapshot_id_saved,
                operator_id=operator_id,
                result="failed",
                message=str(e)[:500],
            )
            raise

    def _demand_to_snapshot_dict(self, demand: Demand) -> Dict[str, Any]:
        """将 Demand 转为可 JSON 序列化的快照字典"""
        return {
            "demand_code": demand.demand_code,
            "demand_type": demand.demand_type,
            "demand_name": demand.demand_name,
            "total_quantity": str(demand.total_quantity),
            "total_amount": str(demand.total_amount),
            "start_date": demand.start_date.isoformat() if demand.start_date else None,
            "end_date": demand.end_date.isoformat() if demand.end_date else None,
            "source_type": demand.source_type,
            "source_id": demand.source_id,
        }

    def _demand_item_to_snapshot_dict(self, item: DemandItem) -> Dict[str, Any]:
        """将 DemandItem 转为可 JSON 序列化的快照字典"""
        return {
            "material_code": item.material_code,
            "material_name": item.material_name,
            "required_quantity": str(item.required_quantity),
            "delivery_date": item.delivery_date.isoformat() if getattr(item, "delivery_date", None) else None,
        }

    async def _notify_downstream_recalc(
        self,
        tenant_id: int,
        demand_id: int,
        demand_code: str,
        computation_id: int,
        computation_code: str,
        operator_id: int,
    ) -> None:
        """需求重算后通知下游：关联需求计算建议重新执行（策略 A）。"""
        try:
            template = await self._get_demand_recalc_notify_template(tenant_id)
            if not template:
                logger.warning("未配置 DEMAND_RECALC_NOTIFY 模板，跳过下游重算提醒")
                return
            from core.services.messaging.message_service import MessageService
            from core.schemas.message_template import SendMessageRequest
            recipient_id = str(operator_id)
            await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=recipient_id,
                    template_code="DEMAND_RECALC_NOTIFY",
                    variables={
                        "demand_code": demand_code,
                        "computation_code": computation_code,
                        "computation_id": str(computation_id),
                    },
                    content="",
                ),
            )
        except Exception as e:
            logger.warning("需求重算下游提醒发送失败: %s", e)

    async def _get_demand_recalc_notify_template(self, tenant_id: int):
        """获取需求重算通知模板（若不存在则返回 None）"""
        try:
            from core.services.messaging.message_template_service import MessageTemplateService
            return await MessageTemplateService.get_message_template_by_code(
                tenant_id, "DEMAND_RECALC_NOTIFY"
            )
        except Exception:
            return None

    async def list_demand_recalc_history(
        self, tenant_id: int, demand_id: int, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取需求重算历史列表，供前端「重算过程」展示。"""
        await self.get_demand_by_id(tenant_id, demand_id)
        rows = await DemandRecalcHistory.filter(
            tenant_id=tenant_id, demand_id=demand_id
        ).order_by("-recalc_at").limit(limit)
        return [
            {
                "id": r.id,
                "recalc_at": r.recalc_at.isoformat() if r.recalc_at else None,
                "trigger_type": r.trigger_type,
                "source_type": r.source_type,
                "source_id": r.source_id,
                "trigger_reason": r.trigger_reason,
                "snapshot_id": r.snapshot_id,
                "operator_id": r.operator_id,
                "result": r.result,
                "message": r.message,
            }
            for r in rows
        ]

    async def list_demand_snapshots(
        self, tenant_id: int, demand_id: int, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """获取需求快照列表。"""
        await self.get_demand_by_id(tenant_id, demand_id)
        rows = await DemandSnapshot.filter(
            tenant_id=tenant_id, demand_id=demand_id
        ).order_by("-snapshot_at").limit(limit)
        return [
            {
                "id": r.id,
                "snapshot_type": r.snapshot_type,
                "snapshot_at": r.snapshot_at.isoformat() if r.snapshot_at else None,
                "trigger_reason": r.trigger_reason,
                "demand_snapshot": r.demand_snapshot,
                "demand_items_snapshot": r.demand_items_snapshot,
            }
            for r in rows
        ]

    async def push_to_computation(
        self,
        tenant_id: int,
        demand_id: int,
        created_by: int
    ) -> Dict[str, Any]:
        """
        将需求下推到物料需求运算
        
        只能下推已审核的需求。下推后会：
        1. 标记需求为已下推
        2. 创建需求计算任务（待步骤1.2实现统一需求计算服务后完善）
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            created_by: 操作人ID
            
        Returns:
            Dict: 包含下推结果的信息
            
        Raises:
            NotFoundError: 需求不存在
            ValidationError: 需求状态不符合下推条件
        """
        async with in_transaction():
            # 获取需求
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
            if not demand:
                raise NotFoundError("需求", str(demand_id))
            
            # 验证需求状态：只能下推已审核的需求
            if demand.status != DemandStatus.AUDITED:
                raise ValidationError(f"只能下推已审核的需求，当前状态：{demand.status}")
            
            if demand.review_status != ReviewStatus.APPROVED:
                raise ValidationError(f"只能下推审核通过的需求，当前审核状态：{demand.review_status}")
            
            # 检查是否已经下推过
            if demand.pushed_to_computation:
                # 检查是否真的存在计算记录
                from apps.kuaizhizao.models.demand_computation import DemandComputation
                exists = await DemandComputation.filter(tenant_id=tenant_id, demand_id=demand_id).exists()
                if exists:
                    raise ValidationError("该需求已经下推到需求计算，不能重复下推")
                else:
                    logger.warning(f"需求 {demand.demand_code} 标记为已下推但未找到计算记录，允许重新下推")
            
            # 确定计算类型：MTO/销售订单 -> LRP (按单), MTS/销售预测 -> MRP (批产)
            if demand.business_mode == "MTO" or demand.demand_type == "sales_order":
                computation_type = "LRP"
            else:
                computation_type = "MRP"
                
            # 设置默认计算参数
            default_params = {
                "include_safety_stock": True,
                "include_in_transit": True,
                "include_reserved": True,
                "include_reorder_point": False,
                "bom_expand_level": 10
            }
            
            # 创建需求计算任务
            try:
                from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
                from apps.kuaizhizao.schemas.demand_computation import DemandComputationCreate
                
                comp_service = DemandComputationService()
                comp_data = DemandComputationCreate(
                    demand_id=demand_id,
                    computation_type=computation_type,
                    computation_params=default_params,
                    notes=f"从需求 {demand.demand_code} 下推创建"
                )
                
                computation = await comp_service.create_computation(
                    tenant_id=tenant_id,
                    computation_data=comp_data,
                    created_by=created_by
                )
                
                computation_code = computation.computation_code
                computation_id = computation.id
                
                # 更新需求状态
                await Demand.filter(
                    tenant_id=tenant_id,
                    id=demand_id
                ).update(
                    pushed_to_computation=True,
                    computation_id=computation_id,
                    computation_code=computation_code,
                    updated_by=created_by,
                    updated_at=datetime.now()
                )
                
                logger.info(f"需求 {demand.demand_code} 已下推到需求计算，计算编码：{computation_code}")
                
                return {
                    "success": True,
                    "message": "需求下推成功",
                    "demand_code": demand.demand_code,
                    "computation_code": computation_code,
                    "computation_id": computation_id
                }
            except Exception as e:
                logger.error(f"创建需求计算任务失败: {e}")
                raise BusinessLogicError(f"下推失败：创建计算任务出错 - {str(e)}")

    async def withdraw_demand(
        self, 
        tenant_id: int, 
        demand_id: int, 
        withdrawn_by: int
    ) -> DemandResponse:
        """
        撤回已提交的需求
        
        只有“待审核”状态的需求可以撤回。撤回后状态恢复为“草稿”。
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            withdrawn_by: 撤回人ID
            
        Returns:
            DemandResponse: 撤回后的需求响应
            
        Raises:
            NotFoundError: 需求不存在
            BusinessLogicError: 需求状态不允许撤回
        """
        async with in_transaction():
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
            if not demand:
                raise NotFoundError(f"需求不存在: {demand_id}")
            
            # 只能撤回待审核状态的需求
            if demand.status != DemandStatus.PENDING_REVIEW:
                raise BusinessLogicError(f"只能撤回待审核状态的需求，当前状态: {demand.status}")
            
            # 检查是否有正在运行的审批流程，如果有则取消
            try:
                from core.services.approval.approval_instance_service import ApprovalInstanceService
                await ApprovalInstanceService.cancel_approval(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id,
                    operator_id=withdrawn_by,
                )
            except Exception as e:
                logger.warning(f"取消审批流程失败或无需取消: {e}")
            
            # 使用状态流转服务记录
            try:
                from apps.kuaizhizao.services.state_transition_service import StateTransitionService
                state_service = StateTransitionService()
                operator_name = await self.get_user_name(withdrawn_by)
                
                await state_service.transition_state(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id,
                    from_state=demand.status,
                    to_state=DemandStatus.DRAFT,
                    operator_id=withdrawn_by,
                    operator_name=operator_name,
                    transition_reason="用户撤回"
                )
            except Exception as e:
                logger.warning(f"发送状态流转失败: {e}")
            
            # 更新状态为草稿，重置审核状态
            await Demand.filter(tenant_id=tenant_id, id=demand_id).update(
                status=DemandStatus.DRAFT,
                review_status=ReviewStatus.PENDING, # 这里保持待审核可能不太对，应该重置为初始状态，但 DemandResponse 中默认为待审核
                updated_by=withdrawn_by,
                updated_at=datetime.now()
            )
            
            return await self.get_demand_by_id(tenant_id, demand_id)
