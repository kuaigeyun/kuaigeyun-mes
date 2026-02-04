"""
销售订单管理服务模块

提供销售订单相关的业务逻辑处理。

Author: Luigi Lu
Date: 2026-01-19
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from loguru import logger

from apps.kuaizhizao.services.demand_service import DemandService
from apps.kuaizhizao.schemas.demand import (
    DemandCreate, DemandUpdate, DemandResponse, DemandListResponse,
    DemandItemCreate, DemandItemUpdate, DemandItemResponse,
)
from apps.kuaizhizao.schemas.sales_order import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderListResponse,
    SalesOrderItemCreate, SalesOrderItemUpdate, SalesOrderItemResponse,
)
from apps.kuaizhizao.constants import DemandStatus
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class SalesOrderService:
    """
    销售订单管理服务
    
    提供销售订单的独立管理功能，内部使用需求管理服务，但固定为销售订单类型。
    """

    def __init__(self):
        self.demand_service = DemandService()
        self.business_config_service = BusinessConfigService()

    def _convert_sales_order_to_demand(self, sales_order_data: SalesOrderCreate) -> DemandCreate:
        """将销售订单数据转换为需求数据"""
        # 注意：订单编码应该在调用此方法之前已经自动生成（在create_sales_order中）
        # 如果仍然为空，说明自动生成失败，抛出错误
        if not sales_order_data.order_code:
            raise ValidationError("订单编码不能为空，请检查编码生成规则配置")
        
        # 订单名称选填：不填时用订单编码作为需求名称（Demand.demand_name 非空）
        demand_name = (sales_order_data.order_name or "").strip() or sales_order_data.order_code
        return DemandCreate(
            demand_type="sales_order",
            business_mode="MTO",
            demand_code=sales_order_data.order_code,
            demand_name=demand_name,
            start_date=sales_order_data.order_date,
            end_date=sales_order_data.delivery_date,
            customer_id=sales_order_data.customer_id,
            customer_name=sales_order_data.customer_name,
            customer_contact=sales_order_data.customer_contact,
            customer_phone=sales_order_data.customer_phone,
            order_date=sales_order_data.order_date,
            delivery_date=sales_order_data.delivery_date,
            total_quantity=sales_order_data.total_quantity,
            total_amount=sales_order_data.total_amount,
            status=sales_order_data.status,
            salesman_id=sales_order_data.salesman_id,
            salesman_name=sales_order_data.salesman_name,
            shipping_address=sales_order_data.shipping_address,
            shipping_method=sales_order_data.shipping_method,
            payment_terms=sales_order_data.payment_terms,
            notes=sales_order_data.notes,
            items=[
                DemandItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    required_quantity=item.required_quantity,
                    delivery_date=item.delivery_date,
                    unit_price=item.unit_price,
                    item_amount=item.item_amount,
                    notes=item.notes,
                )
                for item in sales_order_data.items
            ],
        )

    def _convert_demand_to_sales_order(self, demand: DemandResponse) -> SalesOrderResponse:
        """将需求数据转换为销售订单数据"""
        return SalesOrderResponse(
            id=demand.id,
            uuid=demand.uuid,
            tenant_id=demand.tenant_id,
            order_code=demand.demand_code,
            order_name=demand.demand_name,
            order_date=demand.start_date,
            delivery_date=demand.delivery_date or demand.end_date or demand.start_date,
            customer_id=demand.customer_id or 0,
            customer_name=demand.customer_name or "",
            customer_contact=demand.customer_contact,
            customer_phone=demand.customer_phone,
            total_quantity=demand.total_quantity,
            total_amount=demand.total_amount,
            status=demand.status,
            submit_time=demand.submit_time,
            reviewer_id=demand.reviewer_id,
            reviewer_name=demand.reviewer_name,
            review_time=demand.review_time,
            review_status=demand.review_status,
            review_remarks=demand.review_remarks,
            salesman_id=demand.salesman_id,
            salesman_name=demand.salesman_name,
            shipping_address=demand.shipping_address,
            shipping_method=demand.shipping_method,
            payment_terms=demand.payment_terms,
            notes=demand.notes,
            pushed_to_computation=demand.pushed_to_computation,
            computation_id=demand.computation_id,
            computation_code=demand.computation_code,
            is_active=demand.is_active,
            created_by=demand.created_by,
            updated_by=demand.updated_by,
            created_at=demand.created_at,
            updated_at=demand.updated_at,
            items=[
                SalesOrderItemResponse(
                    id=item.id,
                    uuid=item.uuid,
                    tenant_id=item.tenant_id,
                    sales_order_id=item.demand_id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    required_quantity=item.required_quantity,
                    delivery_date=item.delivery_date or date.today(),
                    delivered_quantity=item.delivered_quantity,
                    remaining_quantity=item.remaining_quantity,
                    delivery_status=item.delivery_status,
                    unit_price=item.unit_price,
                    item_amount=item.item_amount,
                    work_order_id=item.work_order_id,
                    work_order_code=item.work_order_code,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in (demand.items or [])
            ] if demand.items else None,
            duration_info=getattr(demand, 'duration_info', None),
        )

    async def create_sales_order(
        self,
        tenant_id: int,
        sales_order_data: SalesOrderCreate,
        created_by: int
    ) -> SalesOrderResponse:
        """
        创建销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_data: 销售订单创建数据
            created_by: 创建人ID
            
        Returns:
            SalesOrderResponse: 创建的销售订单响应
        """
        # 1. 检查模块是否启用
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "sales_order")
        if not is_enabled:
            raise BusinessLogicError("销售管理模块未启用，无法创建销售订单")

        # 如果没有提供订单编码，按编码规则或回退逻辑自动生成
        if not sales_order_data.order_code:
            from core.config.code_rule_pages import CODE_RULE_PAGES
            from core.services.business.code_generation_service import CodeGenerationService

            rule_code = next(
                (p.get("rule_code") for p in CODE_RULE_PAGES if p.get("page_code") == "kuaizhizao-sales-order"),
                None
            )
            context = {}
            if sales_order_data.order_date:
                context["order_date"] = (
                    sales_order_data.order_date.isoformat()
                    if hasattr(sales_order_data.order_date, "isoformat")
                    else str(sales_order_data.order_date)
                )
            order_code = None
            if rule_code:
                try:
                    order_code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code=rule_code,
                        context=context or None,
                    )
                    logger.debug("销售订单编码由编码规则生成: %s", order_code)
                except (ValidationError, Exception) as e:
                    logger.warning("编码规则生成销售订单编码失败，回退到默认生成: %s", e)
            if not order_code:
                order_code = await self.demand_service._generate_demand_code(
                    tenant_id=tenant_id,
                    demand_type="sales_order",
                )
            sales_order_data.order_code = order_code
        
        # 转换为需求数据
        demand_data = self._convert_sales_order_to_demand(sales_order_data)
        
        # 调用需求服务创建
        demand = await self.demand_service.create_demand(
            tenant_id=tenant_id,
            demand_data=demand_data,
            created_by=created_by
        )
        
        # 转换为销售订单响应
        return self._convert_demand_to_sales_order(demand)

    async def get_sales_order_by_id(
        self,
        tenant_id: int,
        sales_order_id: int,
        include_items: bool = False,
        include_duration: bool = False
    ) -> SalesOrderResponse:
        """
        获取销售订单详情
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            include_items: 是否包含明细
            include_duration: 是否包含耗时统计
            
        Returns:
            SalesOrderResponse: 销售订单响应
        """
        # 调用需求服务获取（只获取销售订单类型）
        demand = await self.demand_service.get_demand_by_id(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            include_items=include_items,
            include_duration=include_duration
        )
        
        # 验证是否为销售订单类型
        if demand.demand_type != "sales_order":
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        
        # 转换为销售订单响应
        return self._convert_demand_to_sales_order(demand)

    async def list_sales_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        review_status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> SalesOrderListResponse:
        """
        获取销售订单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 订单状态
            review_status: 审核状态
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            SalesOrderListResponse: 销售订单列表响应
        """
        # 调用需求服务获取列表（固定为销售订单类型）
        demand_list_result = await self.demand_service.list_demands(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            demand_type="sales_order",
            business_mode="MTO",
            status=status,
            review_status=review_status,
            start_date=start_date,
            end_date=end_date,
        )
        
        # demand_list_result 是字典格式，包含 data, total, success
        # data 是 DemandListResponse 对象的列表（已序列化为字典）
        from apps.kuaizhizao.schemas.demand import DemandResponse
        
        # 转换为销售订单列表响应
        sales_orders = []
        for demand_dict in demand_list_result.get("data", []):
            # 将字典转换为 DemandResponse 对象
            demand = DemandResponse.model_validate(demand_dict)
            # 转换为销售订单响应
            sales_orders.append(self._convert_demand_to_sales_order(demand))
        
        return SalesOrderListResponse(
            data=sales_orders,
            total=demand_list_result.get("total", 0),
            success=demand_list_result.get("success", True),
        )

    async def update_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        sales_order_data: SalesOrderUpdate,
        updated_by: int
    ) -> SalesOrderResponse:
        """
        更新销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            sales_order_data: 销售订单更新数据
            updated_by: 更新人ID
            
        Returns:
            SalesOrderResponse: 更新后的销售订单响应
        """
        # 转换为需求更新数据（订单名称未传时不更新 demand_name，避免覆盖为 None）
        update_kw: Dict[str, Any] = {
            "start_date": sales_order_data.order_date,
            "end_date": sales_order_data.delivery_date,
            "customer_id": sales_order_data.customer_id,
            "customer_name": sales_order_data.customer_name,
            "customer_contact": sales_order_data.customer_contact,
            "customer_phone": sales_order_data.customer_phone,
            "order_date": sales_order_data.order_date,
            "delivery_date": sales_order_data.delivery_date,
            "total_quantity": sales_order_data.total_quantity,
            "total_amount": sales_order_data.total_amount,
            "status": sales_order_data.status,
            "salesman_id": sales_order_data.salesman_id,
            "salesman_name": sales_order_data.salesman_name,
            "shipping_address": sales_order_data.shipping_address,
            "shipping_method": sales_order_data.shipping_method,
            "payment_terms": sales_order_data.payment_terms,
            "notes": sales_order_data.notes,
            "items": [
                DemandItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    required_quantity=item.required_quantity,
                    delivery_date=item.delivery_date,
                    unit_price=item.unit_price,
                    item_amount=item.item_amount,
                    notes=item.notes,
                )
                for item in (sales_order_data.items or [])
            ] if sales_order_data.items else None,
        }
        if sales_order_data.order_name is not None:
            update_kw["demand_name"] = sales_order_data.order_name
        demand_update = DemandUpdate(**update_kw)
        
        # 调用需求服务更新
        demand = await self.demand_service.update_demand(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            demand_data=demand_update,
            updated_by=updated_by
        )
        
        # 转换为销售订单响应
        return self._convert_demand_to_sales_order(demand)

    async def submit_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        submitted_by: int
    ) -> SalesOrderResponse:
        """
        提交销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            submitted_by: 提交人ID
            
        Returns:
            SalesOrderResponse: 提交后的销售订单响应
        """
        demand = await self.demand_service.submit_demand(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            submitted_by=submitted_by
        )
        
        # 2. 检查是否需要审核
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "sales_order")
        if not audit_required:
            logger.info(f"销售订单 {sales_order_id} 无需审核，自动通过")
            # 自动审核通过（以提交人作为审核人）
            demand = await self.demand_service.approve_demand(
                tenant_id=tenant_id,
                demand_id=sales_order_id,
                approved_by=submitted_by,
                rejection_reason=None
            )
            
        return self._convert_demand_to_sales_order(demand)

    async def approve_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        approved_by: int
    ) -> SalesOrderResponse:
        """
        审核通过销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            approved_by: 审核人ID
            
        Returns:
            SalesOrderResponse: 审核后的销售订单响应
        """
        demand = await self.demand_service.approve_demand(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            approved_by=approved_by,
            rejection_reason=None
        )
        return self._convert_demand_to_sales_order(demand)

    async def reject_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        approved_by: int,
        rejection_reason: str
    ) -> SalesOrderResponse:
        """
        驳回销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            approved_by: 审核人ID
            rejection_reason: 驳回原因
            
        Returns:
            SalesOrderResponse: 驳回后的销售订单响应
        """
        demand = await self.demand_service.approve_demand(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            approved_by=approved_by,
            rejection_reason=rejection_reason
        )
        return self._convert_demand_to_sales_order(demand)

    async def unapprove_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        unapproved_by: int
    ) -> SalesOrderResponse:
        """
        反审核销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            unapproved_by: 操作人ID
            
        Returns:
            SalesOrderResponse: 反审核后的销售订单响应
        """
        demand = await self.demand_service.unapprove_demand(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            unapproved_by=unapproved_by
        )
        return self._convert_demand_to_sales_order(demand)

    async def push_sales_order_to_computation(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int
    ) -> Dict[str, Any]:
        """
        下推销售订单到需求计算
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            created_by: 创建人ID
            
        Returns:
            Dict: 下推结果
        """
        return await self.demand_service.push_to_computation(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            created_by=created_by
        )

    async def withdraw_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        withdrawn_by: int
    ) -> SalesOrderResponse:
        """
        撤回销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            withdrawn_by: 撤回人ID
            
        Returns:
            SalesOrderResponse: 撤回后的销售订单响应
        """
        demand = await self.demand_service.withdraw_demand(
            tenant_id=tenant_id,
            demand_id=sales_order_id,
            withdrawn_by=withdrawn_by
        )
        return self._convert_demand_to_sales_order(demand)

    async def delete_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int
    ) -> None:
        """
        删除销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单状态不允许删除
        """
        # 调用需求服务删除
        await self.demand_service.delete_demand(
            tenant_id=tenant_id,
            demand_id=sales_order_id
        )

    async def bulk_delete_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int]
    ) -> Dict[str, Any]:
        """
        批量删除销售订单
        
        Args:
            tenant_id: 租户ID
            sales_order_ids: 销售订单ID列表
            
        Returns:
            Dict: 删除结果
        """
        return await self.demand_service.bulk_delete_demands(
            tenant_id=tenant_id,
            demand_ids=sales_order_ids
        )

    async def confirm_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        confirmed_by: int
    ) -> SalesOrderResponse:
        """
        确认销售订单（转为执行模式）
        """
        from apps.kuaizhizao.models.demand import Demand
        from tortoise.transactions import in_transaction

        async with in_transaction():
            # 获取需求
            demand_obj = await self.demand_service.get_demand_by_id(tenant_id, sales_order_id)
            if demand_obj.status != DemandStatus.AUDITED:
                raise BusinessLogicError("只有已审核状态的销售订单才能确认")

            await Demand.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.CONFIRMED,
                updated_by=confirmed_by,
                updated_at=datetime.now()
            )
            
            # 重新获取更新后的数据
            updated_demand = await self.demand_service.get_demand_by_id(tenant_id, sales_order_id)
            return self._convert_demand_to_sales_order(updated_demand)

    async def push_sales_order_to_delivery(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None
    ) -> Dict[str, Any]:
        """
        下推销售订单到销售出库
        """
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService
        
        # 兼容性处理：SalesDeliveryService 可能还依赖旧的 SalesOrder 模型
        # 但我们这里传入的是 demand_id。如果 SalesDeliveryService 内部是通过 ID 查询 SalesOrder，那它会报错。
        # 我们需要检查 SalesDeliveryService 是否支持 Demand。
        
        # 暂时调用旧服务的逻辑，但传入 demand 映射
        # 注意：这里可能需要更多的适配
        
        # TODO: 适配 SalesDeliveryService 以支持 Demand 模型
        # 目前先抛出待实现错误，或者尝试调用（如果它只依赖 ID 且表名相同，那倒是能跑，但表名不同！）
        
        raise BusinessLogicError("销售出库下推功能正在适配统一需求模型，请稍后再试")

