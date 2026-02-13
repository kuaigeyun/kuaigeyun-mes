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

            # 准备创建数据，排除forecast_code（因为我们要使用生成的编码）
            create_data = forecast_data.model_dump(exclude_unset=True, exclude={'created_by', 'forecast_code'})
            create_data['forecast_code'] = code
            create_data['created_by'] = created_by
            create_data['created_by_name'] = user_info["name"]
            
            forecast = await SalesForecast.create(
                tenant_id=tenant_id,
                **create_data
            )
            
            # 创建预测明细（如果提供了items）
            items_data = forecast_data.model_dump().get('items', [])
            if items_data:
                for item_data in items_data:
                    await SalesForecastItem.create(
                        tenant_id=tenant_id,
                        forecast_id=forecast.id,
                        **item_data
                    )
            
            return SalesForecastResponse.model_validate(forecast)

    async def get_sales_forecast_by_id(self, tenant_id: int, forecast_id: int) -> SalesForecastResponse:
        """根据ID获取销售预测"""
        forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=forecast_id)
        if not forecast:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        return SalesForecastResponse.model_validate(forecast)

    async def list_sales_forecasts(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取销售预测列表"""
        query = SalesForecast.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('forecast_period'):
            query = query.filter(forecast_period=filters['forecast_period'])

        # 获取总数
        total = await query.count()
        
        # 获取分页数据
        forecasts = await query.offset(skip).limit(limit).order_by('-created_at')
        
        # 返回前端期望的格式
        return {
            "data": [SalesForecastListResponse.model_validate(forecast).model_dump() for forecast in forecasts],
            "total": total,
            "success": True
        }

    async def update_sales_forecast(self, tenant_id: int, forecast_id: int, forecast_data: SalesForecastUpdate, updated_by: int) -> SalesForecastResponse:
        """更新销售预测；若提供 items 则先删后增，覆盖全部明细"""
        async with in_transaction():
            await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            dumped = forecast_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            items_data = dumped.pop('items', None)
            update_data = {k: v for k, v in dumped.items() if k != 'items'}
            update_data['updated_by'] = updated_by

            await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(**update_data)

            if items_data is not None:
                await SalesForecastItem.filter(tenant_id=tenant_id, forecast_id=forecast_id).delete()
                for item_data in items_data:
                    await SalesForecastItem.create(
                        tenant_id=tenant_id,
                        forecast_id=forecast_id,
                        **item_data
                    )

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

    async def submit_forecast(self, tenant_id: int, forecast_id: int, submitted_by: int) -> SalesForecastResponse:
        """
        提交销售预测
        
        将草稿状态的销售预测提交为待审核状态
        
        Args:
            tenant_id: 租户ID
            forecast_id: 销售预测ID
            submitted_by: 提交人ID
            
        Returns:
            SalesForecastResponse: 更新后的销售预测
            
        Raises:
            NotFoundError: 销售预测不存在
            BusinessLogicError: 销售预测状态不是草稿
        """
        async with in_transaction():
            forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            
            if forecast.status != "草稿":
                raise BusinessLogicError(f"只有草稿状态的销售预测才能提交，当前状态：{forecast.status}")
            
            # 检查业务配置：若无需审核，则提交后直接设为已审核（考虑中小企业实情）
            from infra.services.business_config_service import BusinessConfigService
            from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
            config_service = BusinessConfigService()
            audit_required = await config_service.check_audit_required(tenant_id, "sales_forecast")

            if not audit_required:
                await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
                    status=DocumentStatus.AUDITED,
                    review_status=ReviewStatus.APPROVED,
                    updated_by=submitted_by
                )
            else:
                await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
                    status="待审核",
                    review_status="待审核",
                    updated_by=submitted_by
                )
            
            updated_forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            return updated_forecast

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入销售预测
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建销售预测。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '预测名称': 'forecast_name',
            '*预测名称': 'forecast_name',
            'forecast_name': 'forecast_name',
            '*forecast_name': 'forecast_name',
            '预测类型': 'forecast_type',
            'forecast_type': 'forecast_type',
            '预测周期': 'forecast_period',
            '*预测周期': 'forecast_period',
            'forecast_period': 'forecast_period',
            '*forecast_period': 'forecast_period',
            '开始日期': 'start_date',
            '*开始日期': 'start_date',
            'start_date': 'start_date',
            '*start_date': 'start_date',
            '结束日期': 'end_date',
            '*结束日期': 'end_date',
            'end_date': 'end_date',
            '*end_date': 'end_date',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['forecast_name', 'forecast_period', 'start_date', 'end_date']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                forecast_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field in ['start_date', 'end_date']:
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                forecast_data[field] = dt.strptime(value_str, fmt).date()
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    forecast_data[field] = value_str
                
                # 验证必填字段
                if not forecast_data.get('forecast_name') or not forecast_data.get('forecast_period'):
                    errors.append({
                        "row": row_idx,
                        "error": "预测名称或预测周期为空"
                    })
                    failure_count += 1
                    continue
                
                if 'start_date' not in forecast_data or 'end_date' not in forecast_data:
                    errors.append({
                        "row": row_idx,
                        "error": "开始日期或结束日期为空或格式错误"
                    })
                    failure_count += 1
                    continue
                
                # 设置默认值
                forecast_data.setdefault('forecast_type', 'MTS')
                forecast_data.setdefault('status', '草稿')
                forecast_data.setdefault('review_status', '待审核')
                
                # 创建销售预测
                forecast_create = SalesForecastCreate(**forecast_data)
                await self.create_sales_forecast(tenant_id, forecast_create, created_by)
                success_count += 1
                
            except Exception as e:
                logger.error(f"导入销售预测失败（第{row_idx}行）: {str(e)}")
                errors.append({
                    "row": row_idx,
                    "error": str(e)
                })
                failure_count += 1
        
        return {
            "success": True,
            "message": "导入完成",
            "total": success_count + failure_count,
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出销售预测到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的销售预测（不分页）
        forecasts = await self.list_sales_forecasts(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"sales_forecasts_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '预测编号', '预测名称', '预测类型', '预测周期', 
                '开始日期', '结束日期', '状态', '审核状态', 
                '审核人', '审核时间', '备注', '创建时间'
            ])
            
            # 写入数据
            for forecast in forecasts:
                writer.writerow([
                    forecast.forecast_code,
                    forecast.forecast_name,
                    forecast.forecast_type,
                    forecast.forecast_period,
                    forecast.start_date.strftime('%Y-%m-%d') if forecast.start_date else '',
                    forecast.end_date.strftime('%Y-%m-%d') if forecast.end_date else '',
                    forecast.status,
                    forecast.review_status,
                    forecast.reviewer_name or '',
                    forecast.review_time.strftime('%Y-%m-%d %H:%M:%S') if forecast.review_time else '',
                    forecast.notes or '',
                    forecast.created_at.strftime('%Y-%m-%d %H:%M:%S') if forecast.created_at else '',
                ])
        
        return file_path

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
        
        # 验证销售预测存在且已审核（兼容枚举与存量中文值）
        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES
        forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
        review_approved = forecast.review_status in ("通过", "APPROVED", "已审核")
        status_audited = forecast.status in LEGACY_AUDITED_VALUES
        if not review_approved or not status_audited:
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
            from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
            
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "SALES_ORDER_CODE", prefix=f"SO{today}")

            # 提取items（如果存在）
            items_data = order_data.model_dump().get('items', [])
            
            # 如果order_data中已包含order_code，则排除它（因为我们要使用生成的编码）
            order_dict = order_data.model_dump(exclude_unset=True, exclude={'created_by', 'order_code', 'items'})
            order_dict['order_code'] = code
            
            order = await SalesOrder.create(
                tenant_id=tenant_id,
                created_by=created_by,
                created_by_name=user_info.get("name", ""),
                **order_dict
            )
            
            # 创建订单明细（仅传入模型字段，required_quantity/item_amount 映射为 order_quantity/total_amount）
            if items_data:
                for item_data in items_data:
                    order_quantity = item_data.get('order_quantity') or item_data.get('required_quantity') or item_data.get('quantity') or 0
                    order_quantity = float(order_quantity) if order_quantity is not None else 0
                    delivered_quantity = float(item_data.get('delivered_quantity') or 0)
                    remaining_quantity = item_data.get('remaining_quantity')
                    if remaining_quantity is not None:
                        remaining_quantity = float(remaining_quantity)
                    else:
                        remaining_quantity = order_quantity - delivered_quantity
                    total_amt = item_data.get('total_amount') if item_data.get('total_amount') is not None else item_data.get('item_amount')
                    total_amt = float(total_amt) if total_amt is not None else (order_quantity * float(item_data.get('unit_price') or 0))
                    delivery_date = item_data.get('delivery_date')
                    if delivery_date is None:
                        delivery_date = order_dict.get('delivery_date')
                    if hasattr(delivery_date, 'isoformat'):
                        delivery_date = date.fromisoformat(delivery_date.isoformat()[:10]) if delivery_date else date.today()
                    elif isinstance(delivery_date, str) and len(delivery_date) >= 10:
                        delivery_date = date.fromisoformat(delivery_date[:10])
                    elif isinstance(delivery_date, date):
                        pass
                    else:
                        delivery_date = date.today()
                    await SalesOrderItem.create(
                        tenant_id=tenant_id,
                        sales_order_id=order.id,
                        material_id=item_data.get('material_id') or 0,
                        material_code=(item_data.get('material_code') or '')[:50],
                        material_name=(item_data.get('material_name') or '')[:200],
                        material_spec=(item_data.get('material_spec') or '')[:200] or None,
                        material_unit=(item_data.get('material_unit') or '')[:20],
                        order_quantity=order_quantity,
                        delivered_quantity=delivered_quantity,
                        remaining_quantity=remaining_quantity,
                        unit_price=float(item_data.get('unit_price') or 0),
                        total_amount=total_amt,
                        delivery_date=delivery_date,
                        delivery_status=item_data.get('delivery_status') or '待交货',
                        work_order_id=item_data.get('work_order_id'),
                        work_order_code=(item_data.get('work_order_code') or '')[:50] or None,
                        notes=item_data.get('notes'),
                    )
            
            return SalesOrderResponse.model_validate(order)

    async def get_sales_order_by_id(
        self, tenant_id: int, order_id: int, include_items: bool = False
    ) -> SalesOrderResponse:
        """根据ID获取销售订单，可选包含订单明细"""
        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")
        resp = SalesOrderResponse.model_validate(order)
        if include_items:
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=order_id
            ).order_by("id")
            resp = resp.model_copy(update={"items": [SalesOrderItemResponse.model_validate(it) for it in items]})
        return resp

    async def list_sales_orders(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesOrderListResponse]:
        """
        获取销售订单列表
        
        注意：返回数组格式，与基础数据管理APP保持一致
        前端在 request 函数中手动包装为 { data, total, success } 格式
        """
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

        # 获取分页数据
        orders = await query.offset(skip).limit(limit).order_by('-created_at')
        
        # 返回数组格式（与车间页面保持一致）
        return [SalesOrderListResponse.model_validate(order).model_dump() for order in orders]

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

    async def push_to_delivery(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None
    ) -> Dict[str, Any]:
        """
        下推到销售出库
        
        从销售订单下推，自动生成销售出库单
        
        Args:
            tenant_id: 租户ID
            order_id: 销售订单ID
            created_by: 创建人ID
            delivery_quantities: 出库数量字典 {item_id: quantity}，如果不提供则使用订单未出库数量
            
        Returns:
            Dict: 包含创建的销售出库单信息
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单未审核或已全部出库
        """
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService
        from apps.kuaizhizao.schemas.warehouse import SalesDeliveryCreate, SalesDeliveryItemCreate
        from decimal import Decimal
        
        # 验证销售订单存在且已审核
        order = await self.get_sales_order_by_id(tenant_id, order_id)
        if order.status not in ["已审核", "已确认", "进行中"]:
            raise BusinessLogicError("只有已审核、已确认或进行中状态的销售订单才能下推到销售出库")
        
        # 获取订单明细
        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id
        ).all()
        
        if not order_items:
            raise BusinessLogicError("销售订单没有明细，无法生成出库单")
        
        # 检查是否有未出库的明细
        has_outstanding = any(
            (item.delivered_quantity or 0) < (item.order_quantity or 0) 
            for item in order_items
        )
        if not has_outstanding:
            raise BusinessLogicError("销售订单已全部出库，无法再次生成出库单")
        
        # 创建销售出库单
        delivery_service = SalesDeliveryService()
        
        # 构建出库单明细
        delivery_items = []
        for item in order_items:
            # 确定出库数量
            if delivery_quantities and item.id in delivery_quantities:
                delivery_quantity = Decimal(str(delivery_quantities[item.id]))
            else:
                delivery_quantity = Decimal(str(item.order_quantity or 0)) - Decimal(str(item.delivered_quantity or 0))
            
            # 跳过数量为0的明细
            if delivery_quantity <= 0:
                continue
            
            # 验证出库数量不超过未出库数量
            outstanding = Decimal(str(item.order_quantity or 0)) - Decimal(str(item.delivered_quantity or 0))
            if delivery_quantity > outstanding:
                raise ValidationError(f"物料 {item.material_code} 的出库数量 {delivery_quantity} 超过未出库数量 {outstanding}")
            
            delivery_items.append(SalesDeliveryItemCreate(
                material_id=item.material_id,
                material_code=item.material_code or '',
                material_name=item.material_name or '',
                material_unit=item.material_unit or '件',
                delivery_quantity=float(delivery_quantity),
                unit_price=float(item.unit_price or 0),
                total_amount=float(delivery_quantity * Decimal(str(item.unit_price or 0)))
            ))
        
        if not delivery_items:
            raise BusinessLogicError("没有可出库的明细")
        
        # 创建出库单
        delivery_data = SalesDeliveryCreate(
            sales_order_id=order_id,
            sales_order_code=order.order_code,
            customer_id=order.customer_id,
            customer_name=order.customer_name or '',
            warehouse_id=1,  # TODO: 从订单或配置中获取默认仓库
            warehouse_name='默认仓库',  # TODO: 从订单或配置中获取默认仓库名称
            items=delivery_items
        )
        
        delivery = await delivery_service.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by
        )
        
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "delivery_id": delivery.id if hasattr(delivery, 'id') else None,
            "delivery_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
            "message": "销售出库单创建成功"
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

    async def submit_order(self, tenant_id: int, order_id: int, submitted_by: int) -> SalesOrderResponse:
        """
        提交销售订单
        
        将草稿状态的销售订单提交为待审核状态
        
        Args:
            tenant_id: 租户ID
            order_id: 销售订单ID
            submitted_by: 提交人ID
            
        Returns:
            SalesOrderResponse: 更新后的销售订单
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单状态不是草稿
        """
        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)
            
            if order.status != "草稿":
                raise BusinessLogicError(f"只有草稿状态的销售订单才能提交，当前状态：{order.status}")
            
            # 更新状态为待审核
            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
                status="待审核",
                review_status="待审核",
                updated_by=submitted_by
            )
            
            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入销售订单
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建销售订单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '客户名称': 'customer_name',
            '*客户名称': 'customer_name',
            'customer_name': 'customer_name',
            '*customer_name': 'customer_name',
            '订单日期': 'order_date',
            '*订单日期': 'order_date',
            'order_date': 'order_date',
            '*order_date': 'order_date',
            '交货日期': 'delivery_date',
            '*交货日期': 'delivery_date',
            'delivery_date': 'delivery_date',
            '*delivery_date': 'delivery_date',
            '订单类型': 'order_type',
            'order_type': 'order_type',
            '发货方式': 'shipping_method',
            'shipping_method': 'shipping_method',
            '收货地址': 'shipping_address',
            'shipping_address': 'shipping_address',
            '付款条件': 'payment_terms',
            'payment_terms': 'payment_terms',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['customer_name', 'order_date', 'delivery_date']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                order_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field in ['order_date', 'delivery_date']:
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                order_data[field] = dt.strptime(value_str, fmt).date()
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    order_data[field] = value_str
                
                # 验证必填字段
                if not order_data.get('customer_name') or not order_data.get('order_date') or not order_data.get('delivery_date'):
                    errors.append({
                        "row": row_idx,
                        "error": "客户名称、订单日期或交货日期为空"
                    })
                    failure_count += 1
                    continue
                
                # 设置默认值
                order_data.setdefault('order_type', 'MTO')
                order_data.setdefault('status', '草稿')
                order_data.setdefault('review_status', '待审核')
                
                # 创建销售订单
                from apps.kuaizhizao.schemas.sales import SalesOrderCreate
                order_create_data = SalesOrderCreate(**order_data)
                
                await self.create_sales_order(
                    tenant_id=tenant_id,
                    order_data=order_create_data,
                    created_by=created_by
                )
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": row_idx,
                    "error": f"导入失败：{str(e)}"
                })
                failure_count += 1
                logger.error(f"导入销售订单失败（第{row_idx}行）：{str(e)}")
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "data": {
                "success_count": success_count,
                "failure_count": failure_count,
                "errors": errors
            }
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出销售订单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的销售订单（不分页）
        orders = await self.list_sales_orders(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"sales_orders_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '订单编号', '客户名称', '订单类型', '订单日期', 
                '交货日期', '状态', '审核状态', '总数量', '总金额',
                '发货方式', '收货地址', '付款条件', '备注', '创建时间'
            ])
            
            # 写入数据
            for order in orders:
                writer.writerow([
                    order.order_code,
                    order.customer_name,
                    order.order_type,
                    order.order_date.strftime('%Y-%m-%d') if order.order_date else '',
                    order.delivery_date.strftime('%Y-%m-%d') if order.delivery_date else '',
                    order.status,
                    order.review_status,
                    str(order.total_quantity) if order.total_quantity else '0',
                    str(order.total_amount) if order.total_amount else '0',
                    order.shipping_method or '',
                    order.shipping_address or '',
                    order.payment_terms or '',
                    order.notes or '',
                    order.created_at.strftime('%Y-%m-%d %H:%M:%S') if order.created_at else '',
                ])
        
        return file_path
