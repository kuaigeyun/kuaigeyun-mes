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

from apps.kuaizhizao.schemas.demand import (
    DemandCreate, DemandUpdate, DemandResponse, DemandListResponse,
    DemandItemCreate, DemandItemUpdate, DemandItemResponse,
)

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
        include_items: bool = False
    ) -> DemandResponse:
        """
        根据ID获取需求
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID
            include_items: 是否包含明细
            
        Returns:
            DemandResponse: 需求响应
            
        Raises:
            NotFoundError: 需求不存在
        """
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
        if not demand:
            raise NotFoundError(f"需求不存在: {demand_id}")
        
        response = DemandResponse.model_validate(demand)
        
        # 如果需要包含明细
        if include_items:
            items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).all()
            response.items = [DemandItemResponse.model_validate(item) for item in items]
        
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
        query = Demand.filter(tenant_id=tenant_id)

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
        
        # 返回前端期望的格式
        return {
            "data": [DemandListResponse.model_validate(demand).model_dump() for demand in demands],
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
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
            if not demand:
                raise NotFoundError(f"需求不存在: {demand_id}")
            
            # 只能更新草稿状态的需求
            if demand.status != "草稿":
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
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
            if not demand:
                raise NotFoundError(f"需求不存在: {demand_id}")
            
            # 只能提交草稿状态的需求
            if demand.status != "草稿":
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
                    to_state="待审核",
                    operator_id=submitted_by,
                    operator_name=submitter_name,
                    transition_reason="提交审核"
                )
            except Exception as e:
                logger.warning(f"状态流转失败: {e}，使用直接更新方式")
            
            # 更新状态为待审核，记录提交时间
            await Demand.filter(tenant_id=tenant_id, id=demand_id).update(
                status="待审核",
                review_status="待审核",
                submit_time=datetime.now(),
                updated_by=submitted_by
            )
            
            # 启动审核流程（如果配置了审核流程）
            try:
                from apps.kuaizhizao.services.approval_flow_service import ApprovalFlowService
                approval_service = ApprovalFlowService()
                flow = await approval_service.start_approval_flow(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id,
                    business_mode=demand.business_mode,
                    demand_type=demand.demand_type
                )
                logger.info(f"需求 {demand.demand_code} 已启动审核流程 {flow.flow_code}")
            except NotFoundError:
                # 没有配置审核流程，使用简单审核模式
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
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
            if not demand:
                raise NotFoundError(f"需求不存在: {demand_id}")
            
            # 只能审核待审核状态的需求
            if demand.review_status != "待审核":
                raise BusinessLogicError(f"只能审核待审核状态的需求，当前审核状态: {demand.review_status}")
            
            # 获取审核人信息
            approver_name = await self.get_user_name(approved_by)
            
            # 尝试使用审核流程服务执行审核
            try:
                from apps.kuaizhizao.services.approval_flow_service import ApprovalFlowService
                approval_service = ApprovalFlowService()
                
                # 检查是否有审核流程
                approval_status = await approval_service.get_approval_status(
                    tenant_id=tenant_id,
                    entity_type="demand",
                    entity_id=demand_id
                )
                
                if approval_status.get("has_flow"):
                    # 使用审核流程执行审核
                    approval_result = "驳回" if rejection_reason else "通过"
                    result = await approval_service.execute_approval(
                        tenant_id=tenant_id,
                        entity_type="demand",
                        entity_id=demand_id,
                        approver_id=approved_by,
                        approver_name=approver_name,
                        approval_result=approval_result,
                        approval_comment=rejection_reason
                    )
                    
                    # 根据审核流程结果更新需求状态
                    if result.get("flow_rejected"):
                        review_status = "驳回"
                        status = "已驳回"
                    elif result.get("flow_completed"):
                        review_status = "通过"
                        status = "已审核"
                    else:
                        # 流程进行中，保持待审核状态
                        review_status = "待审核"
                        status = "待审核"
                else:
                    # 没有审核流程，使用简单审核模式
                    review_status = "驳回" if rejection_reason else "通过"
                    status = "已驳回" if rejection_reason else "已审核"
            except Exception as e:
                logger.warning(f"使用审核流程服务失败: {e}，回退到简单审核模式")
                # 回退到简单审核模式
                review_status = "驳回" if rejection_reason else "通过"
                status = "已驳回" if rejection_reason else "已审核"
            
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
        
        # 根据需求类型确定前缀
        if demand_type == "sales_forecast":
            prefix = f"SF-{today}"
            code_key = "DEMAND_SALES_FORECAST_CODE"
        elif demand_type == "sales_order":
            prefix = f"SO-{today}"
            code_key = "DEMAND_SALES_ORDER_CODE"
        else:
            raise ValidationError(f"无效的需求类型: {demand_type}")
        
        # 生成编码
        code = await self.generate_code(tenant_id, code_key, prefix=prefix)
        
        return code

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
                raise NotFoundError(f"需求明细不存在: {item_id}")
            
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
                raise NotFoundError(f"需求明细不存在: {item_id}")
            
            # 删除明细
            await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id,
                id=item_id
            ).delete()
            
            # 更新需求总数量和总金额
            await self._update_demand_totals(tenant_id, demand_id)

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
            demand = await self.get_demand_by_id(tenant_id, demand_id)
            
            # 验证需求状态：只能下推已审核的需求
            if demand.status != "已审核":
                raise ValidationError(f"只能下推已审核的需求，当前状态：{demand.status}")
            
            if demand.review_status != "通过":
                raise ValidationError(f"只能下推审核通过的需求，当前审核状态：{demand.review_status}")
            
            # 检查是否已经下推过
            if demand.pushed_to_computation:
                raise ValidationError("该需求已经下推到需求计算，不能重复下推")
            
            # TODO: 步骤1.2实现统一需求计算服务后，在这里创建需求计算任务
            # 目前先标记为已下推，并生成一个临时的计算编码
            computation_code = f"COMP-{demand.demand_code}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # 更新需求状态
            await Demand.filter(
                tenant_id=tenant_id,
                id=demand_id
            ).update(
                pushed_to_computation=True,
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
                "note": "需求计算任务将在统一需求计算服务实现后自动创建"
            }
