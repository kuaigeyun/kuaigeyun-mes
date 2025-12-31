"""
销售管理服务模块

提供销售管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from tortoise.functions import Sum
from loguru import logger

from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

from apps.kuaizhizao.schemas.sales import (
    # 销售预测
    SalesForecastCreate, SalesForecastUpdate, SalesForecastResponse, SalesForecastListResponse,
    SalesForecastItemCreate, SalesForecastItemUpdate, SalesForecastItemResponse,
    # 销售订单
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderListResponse,
    SalesOrderItemCreate, SalesOrderItemUpdate, SalesOrderItemResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.user_service import UserService


class SalesForecastService(AppBaseService[SalesForecast]):
    """销售预测服务"""

    def __init__(self):
        super().__init__(SalesForecast)

    async def create_sales_forecast(self, tenant_id: int, forecast_data: SalesForecastCreate, created_by: int) -> SalesForecastResponse:
        """创建销售预测"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "SALES_FORECAST_CODE", prefix=f"SF{today}")

            forecast = await SalesForecast.create(
                tenant_id=tenant_id,
                forecast_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **forecast_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return SalesForecastResponse.model_validate(forecast)

    async def get_sales_forecast_by_id(self, tenant_id: int, forecast_id: int) -> SalesForecastResponse:
        """根据ID获取销售预测"""
        forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=forecast_id)
        if not forecast:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        return SalesForecastResponse.model_validate(forecast)

    async def list_sales_forecasts(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesForecastListResponse]:
        """获取销售预测列表"""
        query = SalesForecast.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('forecast_period'):
            query = query.filter(forecast_period=filters['forecast_period'])

        forecasts = await query.offset(skip).limit(limit).order_by('-created_at')
        return [SalesForecastListResponse.model_validate(forecast) for forecast in forecasts]

    async def update_sales_forecast(self, tenant_id: int, forecast_id: int, forecast_data: SalesForecastUpdate, updated_by: int) -> SalesForecastResponse:
        """更新销售预测"""
        async with in_transaction():
            forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            update_data = forecast_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(**update_data)
            updated_forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            return updated_forecast

    async def approve_forecast(self, tenant_id: int, forecast_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> SalesForecastResponse:
        """审核销售预测"""
        async with in_transaction():
            forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)

            if forecast.review_status != '待审核':
                raise BusinessLogicError("销售预测审核状态不是待审核")

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            updated_forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            return updated_forecast

    async def add_forecast_item(self, tenant_id: int, forecast_id: int, item_data: SalesForecastItemCreate) -> SalesForecastItemResponse:
        """添加销售预测明细"""
        async with in_transaction():
            # 验证预测存在
            await self.get_sales_forecast_by_id(tenant_id, forecast_id)

            item = await SalesForecastItem.create(
                tenant_id=tenant_id,
                forecast_id=forecast_id,
                **item_data.model_dump(exclude_unset=True)
            )
            return SalesForecastItemResponse.model_validate(item)

    async def get_forecast_items(self, tenant_id: int, forecast_id: int) -> List[SalesForecastItemResponse]:
        """获取销售预测明细"""
        items = await SalesForecastItem.filter(tenant_id=tenant_id, forecast_id=forecast_id).order_by('forecast_date')
        return [SalesForecastItemResponse.model_validate(item) for item in items]

    async def push_to_mrp(
        self,
        tenant_id: int,
        forecast_id: int,
        planning_horizon: int = 12,
        time_bucket: str = "week",
        user_id: int = None
    ) -> Dict[str, Any]:
        """
        下推到MRP运算
        
        从销售预测下推到MRP运算，自动执行MRP计算
        
        Args:
            tenant_id: 租户ID
            forecast_id: 销售预测ID
            planning_horizon: 计划周期（月数，默认12个月）
            time_bucket: 时间粒度（week/month，默认week）
            user_id: 用户ID（可选）
            
        Returns:
            Dict: MRP运算结果
            
        Raises:
            NotFoundError: 销售预测不存在
            BusinessLogicError: 销售预测未审核
        """
        from apps.kuaizhizao.services.planning_service import ProductionPlanningService
        from apps.kuaizhizao.schemas.planning import MRPComputationRequest
        
        # 验证销售预测存在且已审核
        forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
        if forecast.review_status != "通过" or forecast.status != "已审核":
            raise BusinessLogicError("只有已审核通过的销售预测才能下推到MRP运算")
        
        # 创建MRP运算请求
        mrp_request = MRPComputationRequest(
            forecast_id=forecast_id,
            planning_horizon=planning_horizon,
            time_bucket=time_bucket
        )
        
        # 执行MRP运算
        planning_service = ProductionPlanningService()
        mrp_result = await planning_service.run_mrp_computation(
            tenant_id=tenant_id,
            request=mrp_request,
            user_id=user_id or forecast.created_by
        )
        
        return {
            "forecast_id": forecast_id,
            "forecast_code": forecast.forecast_code,
            "mrp_result": mrp_result.model_dump() if hasattr(mrp_result, 'model_dump') else mrp_result,
            "message": "MRP运算执行成功"
        }



class SalesOrderService(AppBaseService[SalesOrder]):
    """销售订单服务"""

    def __init__(self):
        super().__init__(SalesOrder)

    async def create_sales_order(self, tenant_id: int, order_data: SalesOrderCreate, created_by: int) -> SalesOrderResponse:
        """创建销售订单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "SALES_ORDER_CODE", prefix=f"SO{today}")

            order = await SalesOrder.create(
                tenant_id=tenant_id,
                order_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **order_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return SalesOrderResponse.model_validate(order)

    async def get_sales_order_by_id(self, tenant_id: int, order_id: int) -> SalesOrderResponse:
        """根据ID获取销售订单"""
        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")
        return SalesOrderResponse.model_validate(order)

    async def list_sales_orders(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesOrderListResponse]:
        """获取销售订单列表"""
        query = SalesOrder.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=filters['customer_id'])
        if filters.get('order_type'):
            query = query.filter(order_type=filters['order_type'])
        if filters.get('delivery_date_start'):
            query = query.filter(delivery_date__gte=filters['delivery_date_start'])
        if filters.get('delivery_date_end'):
            query = query.filter(delivery_date__lte=filters['delivery_date_end'])

        orders = await query.offset(skip).limit(limit).order_by('-created_at')
        return [SalesOrderListResponse.model_validate(order) for order in orders]

    async def update_sales_order(self, tenant_id: int, order_id: int, order_data: SalesOrderUpdate, updated_by: int) -> SalesOrderResponse:
        """更新销售订单"""
        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)
            update_data = order_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(**update_data)
            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def approve_order(self, tenant_id: int, order_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> SalesOrderResponse:
        """审核销售订单"""
        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)

            if order.review_status != '待审核':
                raise BusinessLogicError("销售订单审核状态不是待审核")

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def confirm_order(self, tenant_id: int, order_id: int, confirmed_by: int) -> SalesOrderResponse:
        """确认销售订单（转为MTO模式执行）"""
        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)

            if order.status != '已审核':
                raise BusinessLogicError("只有已审核状态的销售订单才能确认")

            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
                status="已确认",
                updated_by=confirmed_by
            )

            # TODO: 触发LRP运算
            # TODO: 生成专属采购订单
            # TODO: 生成专属工单

            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def add_order_item(self, tenant_id: int, order_id: int, item_data: SalesOrderItemCreate) -> SalesOrderItemResponse:
        """添加销售订单明细"""
        async with in_transaction():
            # 验证订单存在
            await self.get_sales_order_by_id(tenant_id, order_id)

            # 计算剩余数量
            remaining_quantity = item_data.order_quantity - item_data.delivered_quantity

            item = await SalesOrderItem.create(
                tenant_id=tenant_id,
                sales_order_id=order_id,
                remaining_quantity=remaining_quantity,
                **item_data.model_dump(exclude_unset=True)
            )

            # 更新订单总数量和总金额
            await self._update_order_totals(tenant_id, order_id)

            return SalesOrderItemResponse.model_validate(item)

    async def get_order_items(self, tenant_id: int, order_id: int) -> List[SalesOrderItemResponse]:
        """获取销售订单明细"""
        items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=order_id).order_by('delivery_date')
        return [SalesOrderItemResponse.model_validate(item) for item in items]

    async def push_to_lrp(
        self,
        tenant_id: int,
        order_id: int,
        planning_horizon: int = 3,
        consider_capacity: bool = False,
        user_id: int = None
    ) -> Dict[str, Any]:
        """
        下推到LRP运算
        
        从销售订单下推到LRP运算，自动执行LRP计算
        
        Args:
            tenant_id: 租户ID
            order_id: 销售订单ID
            planning_horizon: 计划周期（月数，默认3个月）
            consider_capacity: 是否考虑产能（默认：False）
            user_id: 用户ID（可选）
            
        Returns:
            Dict: LRP运算结果
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单未审核
        """
        from apps.kuaizhizao.services.planning_service import ProductionPlanningService
        from apps.kuaizhizao.schemas.planning import LRPComputationRequest
        
        # 验证销售订单存在且已审核
        order = await self.get_sales_order_by_id(tenant_id, order_id)
        if order.review_status != "通过" or order.status not in ["已审核", "已确认"]:
            raise BusinessLogicError("只有已审核通过或已确认的销售订单才能下推到LRP运算")
        
        # 创建LRP运算请求
        lrp_request = LRPComputationRequest(
            sales_order_id=order_id,
            planning_horizon=planning_horizon,
            consider_capacity=consider_capacity
        )
        
        # 执行LRP运算
        planning_service = ProductionPlanningService()
        lrp_result = await planning_service.run_lrp_computation(
            tenant_id=tenant_id,
            request=lrp_request,
            user_id=user_id or order.created_by
        )
        
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "lrp_result": lrp_result.model_dump() if hasattr(lrp_result, 'model_dump') else lrp_result,
            "message": "LRP运算执行成功"
        }

    async def update_delivery_status(self, tenant_id: int, order_id: int, item_id: int, delivered_quantity: float, updated_by: int) -> SalesOrderItemResponse:
        """更新交货状态"""
        async with in_transaction():
            item = await SalesOrderItem.get_or_none(tenant_id=tenant_id, id=item_id, sales_order_id=order_id)
            if not item:
                raise NotFoundError(f"销售订单明细不存在: {item_id}")

            new_delivered_quantity = item.delivered_quantity + delivered_quantity
            if new_delivered_quantity > item.order_quantity:
                raise ValidationError("交货数量不能超过订单数量")

            new_remaining_quantity = item.order_quantity - new_delivered_quantity
            delivery_status = "已交货" if new_remaining_quantity <= 0 else "部分交货"

            await SalesOrderItem.filter(tenant_id=tenant_id, id=item_id).update(
                delivered_quantity=new_delivered_quantity,
                remaining_quantity=new_remaining_quantity,
                delivery_status=delivery_status,
                updated_by=updated_by
            )

            # 更新订单总数量
            await self._update_order_totals(tenant_id, order_id)

            updated_item = await SalesOrderItem.get(tenant_id=tenant_id, id=item_id)
            return SalesOrderItemResponse.model_validate(updated_item)

    async def _update_order_totals(self, tenant_id: int, order_id: int):
        """更新订单总数量和总金额"""
        # 计算总数量和总金额
        result = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=order_id).aggregate(
            total_quantity=Sum('order_quantity'),
            total_delivered=Sum('delivered_quantity'),
            total_amount=Sum('total_amount')
        )

        total_quantity = result.get('total_quantity', 0) or 0
        total_delivered = result.get('total_delivered', 0) or 0
        total_amount = result.get('total_amount', 0) or 0

        # 判断订单状态
        if total_delivered >= total_quantity and total_quantity > 0:
            status = "已完成"
        elif total_delivered > 0:
            status = "部分交货"
        else:
            status = "已确认"

        await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
            total_quantity=total_quantity,
            total_amount=total_amount,
            status=status
        )

    @staticmethod
