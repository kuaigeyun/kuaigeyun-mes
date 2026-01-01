"""
生产计划服务模块

提供生产计划相关的业务逻辑处理，包括MRP和LRP计算引擎。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger
from collections import defaultdict

from apps.kuaizhizao.models.production_plan import ProductionPlan
from apps.kuaizhizao.models.production_plan_item import ProductionPlanItem
from apps.kuaizhizao.models.mrp_result import MRPResult
from apps.kuaizhizao.models.lrp_result import LRPResult
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.master_data.models.material import Material
from apps.master_data.models.supplier import Supplier

from apps.kuaizhizao.schemas.planning import (
    # 生产计划
    ProductionPlanCreate, ProductionPlanUpdate, ProductionPlanResponse, ProductionPlanListResponse,
    ProductionPlanItemCreate, ProductionPlanItemUpdate, ProductionPlanItemResponse,
    # MRP运算
    MRPResultCreate, MRPResultResponse, MRPResultListResponse,
    MRPComputationRequest, MRPComputationResult,
    # LRP运算
    LRPResultCreate, LRPResultResponse, LRPResultListResponse,
    LRPComputationRequest, LRPComputationResult,
)
from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate, PurchaseOrderItemCreate,
)

from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.user_service import UserService
from apps.kuaizhizao.services.purchase_service import PurchaseService


class ProductionPlanningService(BaseService):
    """生产计划服务"""

    def __init__(self):
        super().__init__(ProductionPlan)
        self.purchase_service = PurchaseService()

    async def run_mrp_computation(self, tenant_id: int, request: MRPComputationRequest, user_id: int) -> MRPComputationResult:
        """执行MRP运算"""
        async with in_transaction():
            # 获取销售预测
            forecast = await SalesForecast.get_or_none(
                tenant_id=tenant_id,
                id=request.forecast_id,
                status="已审核"
            )
            if not forecast:
                raise NotFoundError("未找到已审核的销售预测")

            logger.info(f"开始MRP运算，预测ID: {request.forecast_id}")

            # 创建生产计划
            plan_code = await self._generate_plan_code(tenant_id, "MRP")
            plan = await ProductionPlan.create(
                tenant_id=tenant_id,
                plan_code=plan_code,
                plan_name=f"MRP计划-{forecast.forecast_name}",
                plan_type="MRP",
                source_type="SalesForecast",
                source_id=request.forecast_id,
                source_code=forecast.forecast_code,
                plan_start_date=forecast.start_date,
                plan_end_date=forecast.end_date,
                created_by=user_id
            )

            # 获取预测明细
            forecast_items = await SalesForecastItem.filter(
                tenant_id=tenant_id,
                forecast_id=request.forecast_id
            ).order_by('forecast_date')

            material_results = []
            total_work_orders = 0
            total_purchase_orders = 0

            # 对每个预测物料执行MRP计算
            for item in forecast_items:
                mrp_result = await self._compute_material_mrp(
                    tenant_id, item, request.planning_horizon, request.time_bucket
                )

                # 保存MRP结果
                await MRPResult.create(
                    tenant_id=tenant_id,
                    forecast_id=request.forecast_id,
                    material_id=item.material_id,
                    planning_horizon=request.planning_horizon,
                    time_bucket=request.time_bucket,
                    current_inventory=mrp_result.get('current_inventory', 0),
                    safety_stock=mrp_result.get('safety_stock', 0),
                    reorder_point=mrp_result.get('reorder_point', 0),
                    total_gross_requirement=mrp_result.get('total_gross_requirement', 0),
                    total_net_requirement=mrp_result.get('total_net_requirement', 0),
                    total_planned_receipt=mrp_result.get('total_planned_receipt', 0),
                    total_planned_release=mrp_result.get('total_planned_release', 0),
                    suggested_work_orders=mrp_result.get('suggested_work_orders', 0),
                    suggested_purchase_orders=mrp_result.get('suggested_purchase_orders', 0),
                    computation_time=datetime.now(),
                    demand_schedule=mrp_result.get('demand_schedule', {}),
                    inventory_schedule=mrp_result.get('inventory_schedule', {}),
                    planned_order_schedule=mrp_result.get('planned_order_schedule', {})
                )

                # 创建计划明细
                await ProductionPlanItem.create(
                    tenant_id=tenant_id,
                    plan_id=plan.id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_type=item.component_type,
                    planned_quantity=mrp_result.get('total_net_requirement', 0),
                    planned_date=item.forecast_date,
                    gross_requirement=mrp_result.get('total_gross_requirement', 0),
                    net_requirement=mrp_result.get('total_net_requirement', 0),
                    suggested_action=self._determine_action(item.component_type, mrp_result),
                    work_order_quantity=mrp_result.get('suggested_work_orders', 0),
                    purchase_order_quantity=mrp_result.get('suggested_purchase_orders', 0),
                    lead_time=mrp_result.get('lead_time', 0)
                )

                material_results.append(mrp_result)
                total_work_orders += mrp_result.get('suggested_work_orders', 0)
                total_purchase_orders += mrp_result.get('suggested_purchase_orders', 0)

            # 更新计划统计
            await ProductionPlan.filter(id=plan.id).update(
                total_work_orders=total_work_orders,
                total_purchase_orders=total_purchase_orders
            )

            logger.info(f"MRP运算完成，共涉及 {len(material_results)} 个物料")

            return MRPComputationResult(
                forecast_id=request.forecast_id,
                computation_time=datetime.now(),
                total_materials=len(material_results),
                suggested_work_orders=total_work_orders,
                suggested_purchase_orders=total_purchase_orders,
                material_results=material_results
            )

    async def run_lrp_computation(self, tenant_id: int, request: LRPComputationRequest, user_id: int) -> LRPComputationResult:
        """执行LRP运算"""
        async with in_transaction():
            # 获取销售订单
            sales_order = await SalesOrder.get_or_none(
                tenant_id=tenant_id,
                id=request.sales_order_id,
                status="已确认"
            )
            if not sales_order:
                raise NotFoundError("未找到已确认的销售订单")

            logger.info(f"开始LRP运算，订单ID: {request.sales_order_id}")

            # 创建生产计划
            plan_code = await self._generate_plan_code(tenant_id, "LRP")
            plan = await ProductionPlan.create(
                tenant_id=tenant_id,
                plan_code=plan_code,
                plan_name=f"LRP计划-{sales_order.order_code}",
                plan_type="LRP",
                source_type="SalesOrder",
                source_id=request.sales_order_id,
                source_code=sales_order.order_code,
                plan_start_date=date.today(),
                plan_end_date=sales_order.delivery_date,
                created_by=user_id
            )

            # 获取订单明细
            order_items = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id=request.sales_order_id
            )

            production_schedule = []
            procurement_schedule = []
            capacity_utilization = {}

            # 对每个订单物料执行LRP计算
            for item in order_items:
                lrp_result = await self._compute_material_lrp(
                    tenant_id, item, sales_order.delivery_date, request.consider_capacity
                )

                # 保存LRP结果
                await LRPResult.create(
                    tenant_id=tenant_id,
                    sales_order_id=request.sales_order_id,
                    material_id=item.material_id,
                    delivery_date=sales_order.delivery_date,
                    planning_horizon=request.planning_horizon,
                    required_quantity=item.order_quantity,
                    available_inventory=lrp_result.get('available_inventory', 0),
                    net_requirement=lrp_result.get('net_requirement', 0),
                    planned_production=lrp_result.get('planned_production', 0),
                    planned_procurement=lrp_result.get('planned_procurement', 0),
                    production_start_date=lrp_result.get('production_start_date'),
                    production_completion_date=lrp_result.get('production_completion_date'),
                    procurement_start_date=lrp_result.get('procurement_start_date'),
                    procurement_completion_date=lrp_result.get('procurement_completion_date'),
                    bom_id=lrp_result.get('bom_id'),
                    bom_version=lrp_result.get('bom_version'),
                    computation_time=datetime.now(),
                    material_breakdown=lrp_result.get('material_breakdown', {}),
                    capacity_requirements=lrp_result.get('capacity_requirements', {}),
                    procurement_schedule=lrp_result.get('procurement_schedule', {})
                )

                # 创建计划明细
                await ProductionPlanItem.create(
                    tenant_id=tenant_id,
                    plan_id=plan.id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_type="成品",
                    planned_quantity=lrp_result.get('net_requirement', 0),
                    planned_date=sales_order.delivery_date,
                    gross_requirement=item.order_quantity,
                    net_requirement=lrp_result.get('net_requirement', 0),
                    suggested_action="生产" if lrp_result.get('planned_production', 0) > 0 else "采购",
                    work_order_quantity=lrp_result.get('planned_production', 0),
                    purchase_order_quantity=lrp_result.get('planned_procurement', 0),
                    lead_time=lrp_result.get('lead_time', 0)
                )

                # 收集时间表数据
                if lrp_result.get('planned_production', 0) > 0:
                    production_schedule.append({
                        'material_id': item.material_id,
                        'material_code': item.material_code,
                        'quantity': lrp_result.get('planned_production', 0),
                        'start_date': lrp_result.get('production_start_date'),
                        'completion_date': lrp_result.get('production_completion_date')
                    })

                if lrp_result.get('planned_procurement', 0) > 0:
                    procurement_schedule.append({
                        'material_id': item.material_id,
                        'material_code': item.material_code,
                        'quantity': lrp_result.get('planned_procurement', 0),
                        'start_date': lrp_result.get('procurement_start_date'),
                        'completion_date': lrp_result.get('procurement_completion_date')
                    })

            # 判断是否可行（简化判断）
            feasible = len(production_schedule) > 0 or len(procurement_schedule) > 0

            logger.info(f"LRP运算完成，是否可行: {feasible}")

            return LRPComputationResult(
                sales_order_id=request.sales_order_id,
                computation_time=datetime.now(),
                feasible=feasible,
                production_schedule=production_schedule,
                procurement_schedule=procurement_schedule,
                capacity_utilization=capacity_utilization
            )

    async def get_production_plan_by_id(self, tenant_id: int, plan_id: int) -> ProductionPlanResponse:
        """根据ID获取生产计划"""
        plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id)
        if not plan:
            raise NotFoundError(f"生产计划不存在: {plan_id}")
        return ProductionPlanResponse.model_validate(plan)

    async def list_production_plans(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ProductionPlanListResponse]:
        """获取生产计划列表"""
        query = ProductionPlan.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('plan_type'):
            query = query.filter(plan_type=filters['plan_type'])
        if filters.get('status'):
            query = query.filter(status=filters['status'])

        plans = await query.offset(skip).limit(limit).order_by('-created_at')
        return [ProductionPlanListResponse.model_validate(plan) for plan in plans]

    async def get_plan_items(self, tenant_id: int, plan_id: int) -> List[ProductionPlanItemResponse]:
        """获取生产计划明细"""
        items = await ProductionPlanItem.filter(tenant_id=tenant_id, plan_id=plan_id).order_by('planned_date')
        return [ProductionPlanItemResponse.model_validate(item) for item in items]

    async def execute_plan(self, tenant_id: int, plan_id: int, executed_by: int) -> ProductionPlanResponse:
        """执行生产计划"""
        async with in_transaction():
            plan = await self.get_production_plan_by_id(tenant_id, plan_id)

            if plan.status != '已审核':
                raise BusinessLogicError("只有已审核的生产计划才能执行")

            # 获取计划明细
            plan_items = await ProductionPlanItem.filter(tenant_id=tenant_id, plan_id=plan_id)

            work_order_count = 0
            purchase_order_count = 0

            # 为每个需要生产的物料创建工单
            for item in plan_items:
                if item.suggested_action == "生产" and item.work_order_quantity > 0:
                    # TODO: 创建工单
                    # 这里应该调用WorkOrderService创建工单
                    work_order_count += 1

                elif item.suggested_action == "采购" and item.purchase_order_quantity > 0:
                    # 创建采购订单
                    # 获取物料信息
                    material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                    if material:
                        # 查找供应商（这里使用默认供应商，实际应该有更复杂的供应商选择逻辑）
                        supplier = await Supplier.filter(tenant_id=tenant_id).first()
                        if supplier:
                            purchase_order_data = PurchaseOrderCreate(
                                supplier_id=supplier.id,
                                supplier_name=supplier.name,
                                order_date=datetime.now().date(),
                                delivery_date=(datetime.now() + timedelta(days=30)).date(),  # 30天交货期
                                order_type="标准采购",
                                tax_rate=Decimal('0.13'),  # 默认13%税率
                                currency="CNY",
                                exchange_rate=Decimal('1.0'),
                                items=[
                                    PurchaseOrderItemCreate(
                                        material_id=item.material_id,
                                        material_code=item.material_code,
                                        material_name=item.material_name,
                                        ordered_quantity=item.purchase_order_quantity,
                                        unit=item.unit or "件",
                                        unit_price=Decimal('100.00'),  # 默认单价，实际应该从价格表获取
                                        required_date=(datetime.now() + timedelta(days=30)).date(),
                                        inspection_required=True,
                                    )
                                ]
                            )

                            await self.purchase_service.create_purchase_order(
                                tenant_id=tenant_id,
                                order_data=purchase_order_data,
                                created_by=executed_by
                            )
                            purchase_order_count += 1

            # 更新计划状态
            await ProductionPlan.filter(tenant_id=tenant_id, id=plan_id).update(
                execution_status="已执行",
                updated_by=executed_by
            )

            updated_plan = await self.get_production_plan_by_id(tenant_id, plan_id)
            return updated_plan

    async def _compute_material_mrp(self, tenant_id: int, forecast_item: SalesForecastItem, planning_horizon: int, time_bucket: str) -> dict:
        """计算单个物料的MRP"""
        # TODO: 实现完整的MRP计算逻辑
        # 这里是简化的实现

        # 获取当前库存（暂时设为0）
        current_inventory = 0
        safety_stock = 0

        # 计算毛需求
        gross_requirement = forecast_item.forecast_quantity

        # 计算净需求
        net_requirement = max(0, gross_requirement - current_inventory)

        # 根据物料类型决定行动
        if forecast_item.component_type == "自制":
            suggested_work_orders = 1 if net_requirement > 0 else 0
            suggested_purchase_orders = 0
        else:
            suggested_work_orders = 0
            suggested_purchase_orders = 1 if net_requirement > 0 else 0

        return {
            'current_inventory': current_inventory,
            'safety_stock': safety_stock,
            'reorder_point': safety_stock * 2,
            'total_gross_requirement': gross_requirement,
            'total_net_requirement': net_requirement,
            'total_planned_receipt': 0,
            'total_planned_release': 0,
            'suggested_work_orders': suggested_work_orders,
            'suggested_purchase_orders': suggested_purchase_orders,
            'lead_time': 7,  # 默认7天
            'demand_schedule': {},
            'inventory_schedule': {},
            'planned_order_schedule': {}
        }

    async def _compute_material_lrp(self, tenant_id: int, order_item: SalesOrderItem, delivery_date: date, consider_capacity: bool) -> dict:
        """计算单个物料的LRP"""
        # TODO: 实现完整的LRP计算逻辑
        # 这里是简化的实现

        required_quantity = order_item.order_quantity
        available_inventory = 0  # TODO: 从库存服务获取

        net_requirement = max(0, required_quantity - available_inventory)

        # 假设都是自制件，需要生产
        planned_production = net_requirement
        planned_procurement = 0

        # 计算生产时间（简化）
        lead_time = 14  # 假设14天生产周期
        production_start_date = delivery_date - timedelta(days=lead_time)
        production_completion_date = delivery_date

        return {
            'available_inventory': available_inventory,
            'net_requirement': net_requirement,
            'planned_production': planned_production,
            'planned_procurement': planned_procurement,
            'production_start_date': production_start_date,
            'production_completion_date': production_completion_date,
            'procurement_start_date': None,
            'procurement_completion_date': None,
            'bom_id': None,  # TODO: 获取BOM信息
            'bom_version': None,
            'lead_time': lead_time,
            'material_breakdown': {},
            'capacity_requirements': {},
            'procurement_schedule': {}
        }

    def _determine_action(self, material_type: str, mrp_result: dict) -> str:
        """根据物料类型和MRP结果确定建议行动"""
        if material_type == "自制":
            return "生产"
        else:
            return "采购"

    async def get_mrp_result_by_id(self, tenant_id: int, result_id: int) -> Dict[str, Any]:
        """
        根据ID获取MRP运算结果
        
        Returns:
            Dict: MRP运算结果（包含物料信息）
        """
        result = await MRPResult.get_or_none(tenant_id=tenant_id, id=result_id)
        if not result:
            raise NotFoundError(f"MRP运算结果不存在: {result_id}")
        
        # 转换为字典
        result_dict = MRPResultResponse.model_validate(result).model_dump()
        
        # 获取物料信息
        from apps.master_data.models.material import Material
        material = await Material.get_or_none(tenant_id=tenant_id, id=result.material_id)
        if material:
            result_dict['material_code'] = material.material_code
            result_dict['material_name'] = material.material_name
        
        return result_dict
    
    async def list_mrp_results(
        self,
        tenant_id: int,
        forecast_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        获取MRP运算结果列表
        
        Returns:
            Dict: 包含data（结果列表）和total（总数）的字典
        """
        query = MRPResult.filter(tenant_id=tenant_id)
        
        if forecast_id:
            query = query.filter(forecast_id=forecast_id)
        
        # 获取总数
        total = await query.count()
        
        # 获取分页结果
        results = await query.offset(skip).limit(limit).order_by('-computation_time')
        
        # 获取物料信息（扩展结果）
        from apps.master_data.models.material import Material
        result_list = []
        for result in results:
            result_dict = MRPResultListResponse.model_validate(result).model_dump()
            # 获取物料信息
            material = await Material.get_or_none(tenant_id=tenant_id, id=result.material_id)
            if material:
                result_dict['material_code'] = material.material_code
                result_dict['material_name'] = material.material_name
            result_list.append(result_dict)
        
        return {
            "data": result_list,
            "total": total,
            "success": True
        }
    
    async def get_lrp_result_by_id(self, tenant_id: int, result_id: int) -> LRPResultResponse:
        """根据ID获取LRP运算结果"""
        result = await LRPResult.get_or_none(tenant_id=tenant_id, id=result_id)
        if not result:
            raise NotFoundError(f"LRP运算结果不存在: {result_id}")
        return LRPResultResponse.model_validate(result)
    
    async def list_lrp_results(
        self,
        tenant_id: int,
        sales_order_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[LRPResultListResponse]:
        """获取LRP运算结果列表"""
        query = LRPResult.filter(tenant_id=tenant_id)
        
        if sales_order_id:
            query = query.filter(sales_order_id=sales_order_id)
        
        results = await query.offset(skip).limit(limit).order_by('-computation_time')
        return [LRPResultListResponse.model_validate(result) for result in results]

    async def export_mrp_results_to_excel(
        self,
        tenant_id: int,
        forecast_id: Optional[int] = None,
        **filters
    ) -> str:
        """
        导出MRP运算结果到Excel文件
        
        Args:
            tenant_id: 租户ID
            forecast_id: 销售预测ID（可选）
            **filters: 其他过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        from apps.master_data.models.material import Material
        
        # 查询MRP运算结果
        results = await self.list_mrp_results(
            tenant_id=tenant_id,
            forecast_id=forecast_id,
            skip=0,
            limit=10000
        )
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"mrp_results_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '物料编码', '物料名称', '当前库存', '安全库存', '再订货点',
                '总毛需求', '总净需求', '总计划入库', '总计划发放',
                '建议工单数', '建议采购单数', '运算时间'
            ])
            
            # 写入数据
            for result in results:
                # 获取物料信息
                material = await Material.get_or_none(tenant_id=tenant_id, id=result.material_id)
                material_code = material.material_code if material else ''
                material_name = material.material_name if material else ''
                
                writer.writerow([
                    material_code,
                    material_name,
                    str(result.current_inventory or 0),
                    str(result.safety_stock or 0),
                    str(result.reorder_point or 0),
                    str(result.total_gross_requirement or 0),
                    str(result.total_net_requirement or 0),
                    str(result.total_planned_receipt or 0),
                    str(result.total_planned_release or 0),
                    str(result.suggested_work_orders or 0),
                    str(result.suggested_purchase_orders or 0),
                    result.computation_time.strftime('%Y-%m-%d %H:%M:%S') if result.computation_time else '',
                ])
        
        return file_path
    
    async def generate_orders_from_mrp_result(
        self,
        tenant_id: int,
        forecast_id: int,
        created_by: int,
        generate_work_orders: bool = True,
        generate_purchase_orders: bool = True,
        selected_material_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        从MRP运算结果一键生成工单和采购单
        
        Args:
            tenant_id: 租户ID
            forecast_id: 销售预测ID
            created_by: 创建人ID
            generate_work_orders: 是否生成工单
            generate_purchase_orders: 是否生成采购单
            selected_material_ids: 选中的物料ID列表（如果为None则生成所有）
            
        Returns:
            Dict: 包含生成的工单和采购单信息
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.master_data.models.material import Material
        from decimal import Decimal
        
        async with in_transaction():
            # 获取MRP运算结果
            query = MRPResult.filter(tenant_id=tenant_id, forecast_id=forecast_id)
            if selected_material_ids:
                query = query.filter(material_id__in=selected_material_ids)
            
            mrp_results = await query.all()
            
            if not mrp_results:
                raise NotFoundError(f"未找到销售预测 {forecast_id} 的MRP运算结果")
            
            generated_work_orders = []
            generated_purchase_orders = []
            
            for mrp_result in mrp_results:
                # 获取物料信息
                material = await Material.get_or_none(tenant_id=tenant_id, id=mrp_result.material_id)
                if not material:
                    logger.warning(f"物料 {mrp_result.material_id} 不存在，跳过")
                    continue
                
                # 判断物料类型
                is_self_made = material.material_type == "自制" or material.material_type == "成品"
                
                # 生成工单
                if generate_work_orders and is_self_made and mrp_result.suggested_work_orders > 0:
                    try:
                        work_order_data = WorkOrderCreate(
                            name=f"{material.material_name}-MRP工单",
                            product_id=material.id,
                            product_code=material.material_code,
                            product_name=material.material_name,
                            quantity=Decimal(str(mrp_result.total_net_requirement)),
                            production_mode="MTS",
                            status="草稿",
                            priority="normal"
                        )
                        
                        work_order = await WorkOrderService().create_work_order(
                            tenant_id=tenant_id,
                            work_order_data=work_order_data,
                            created_by=created_by
                        )
                        generated_work_orders.append(work_order)
                    except Exception as e:
                        logger.error(f"生成工单失败，物料ID: {mrp_result.material_id}, 错误: {str(e)}")
                        continue
                
                # 生成采购单
                if generate_purchase_orders and not is_self_made and mrp_result.suggested_purchase_orders > 0:
                    try:
                        # 查找供应商（简化实现，使用第一个供应商）
                        supplier = await Supplier.filter(tenant_id=tenant_id).first()
                        if not supplier:
                            logger.warning(f"未找到供应商，物料 {mrp_result.material_id} 无法生成采购单")
                            continue
                        
                        from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
                        
                        purchase_order_data = PurchaseOrderCreate(
                            supplier_id=supplier.id,
                            supplier_name=supplier.name,
                            order_date=datetime.now().date(),
                            delivery_date=(datetime.now() + timedelta(days=30)).date(),
                            order_type="标准采购",
                            tax_rate=Decimal('0.13'),
                            currency="CNY",
                            exchange_rate=Decimal('1.0'),
                            items=[
                                PurchaseOrderItemCreate(
                                    material_id=mrp_result.material_id,
                                    material_code=material.material_code,
                                    material_name=material.material_name,
                                    ordered_quantity=Decimal(str(mrp_result.total_net_requirement)),
                                    unit=material.base_unit or "件",
                                    unit_price=Decimal('0.00'),  # TODO: 从价格表获取
                                    required_date=(datetime.now() + timedelta(days=30)).date(),
                                    inspection_required=True,
                                )
                            ]
                        )
                        
                        purchase_order = await self.purchase_service.create_purchase_order(
                            tenant_id=tenant_id,
                            order_data=purchase_order_data,
                            created_by=created_by
                        )
                        generated_purchase_orders.append(purchase_order)
                    except Exception as e:
                        logger.error(f"生成采购单失败，物料ID: {mrp_result.material_id}, 错误: {str(e)}")
                        continue
            
            return {
                "forecast_id": forecast_id,
                "generated_work_orders": len(generated_work_orders),
                "generated_purchase_orders": len(generated_purchase_orders),
                "work_orders": generated_work_orders,
                "purchase_orders": generated_purchase_orders
            }
    
    async def generate_orders_from_lrp_result(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        generate_work_orders: bool = True,
        generate_purchase_orders: bool = True,
        selected_material_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        从LRP运算结果一键生成工单和采购单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            created_by: 创建人ID
            generate_work_orders: 是否生成工单
            generate_purchase_orders: 是否生成采购单
            selected_material_ids: 选中的物料ID列表（如果为None则生成所有）
            
        Returns:
            Dict: 包含生成的工单和采购单信息
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.master_data.models.material import Material
        from decimal import Decimal
        
        async with in_transaction():
            # 获取销售订单
            sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id)
            if not sales_order:
                raise NotFoundError(f"销售订单不存在: {sales_order_id}")
            
            # 获取LRP运算结果
            query = LRPResult.filter(tenant_id=tenant_id, sales_order_id=sales_order_id)
            if selected_material_ids:
                query = query.filter(material_id__in=selected_material_ids)
            
            lrp_results = await query.all()
            
            if not lrp_results:
                raise NotFoundError(f"未找到销售订单 {sales_order_id} 的LRP运算结果")
            
            generated_work_orders = []
            generated_purchase_orders = []
            
            for lrp_result in lrp_results:
                # 获取物料信息
                material = await Material.get_or_none(tenant_id=tenant_id, id=lrp_result.material_id)
                if not material:
                    logger.warning(f"物料 {lrp_result.material_id} 不存在，跳过")
                    continue
                
                # 生成工单
                if generate_work_orders and lrp_result.planned_production > 0:
                    try:
                        work_order_data = WorkOrderCreate(
                            name=f"{material.material_name}-LRP工单",
                            product_id=material.id,
                            product_code=material.material_code,
                            product_name=material.material_name,
                            quantity=Decimal(str(lrp_result.planned_production)),
                            production_mode="MTO",
                            sales_order_id=sales_order_id,
                            sales_order_code=sales_order.order_code,
                            sales_order_name=sales_order.order_name,
                            status="草稿",
                            priority="normal",
                            planned_start_date=lrp_result.production_start_date,
                            planned_end_date=lrp_result.production_completion_date
                        )
                        
                        work_order = await WorkOrderService().create_work_order(
                            tenant_id=tenant_id,
                            work_order_data=work_order_data,
                            created_by=created_by
                        )
                        generated_work_orders.append(work_order)
                    except Exception as e:
                        logger.error(f"生成工单失败，物料ID: {lrp_result.material_id}, 错误: {str(e)}")
                        continue
                
                # 生成采购单
                if generate_purchase_orders and lrp_result.planned_procurement > 0:
                    try:
                        # 查找供应商（简化实现，使用第一个供应商）
                        supplier = await Supplier.filter(tenant_id=tenant_id).first()
                        if not supplier:
                            logger.warning(f"未找到供应商，物料 {lrp_result.material_id} 无法生成采购单")
                            continue
                        
                        from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
                        
                        purchase_order_data = PurchaseOrderCreate(
                            supplier_id=supplier.id,
                            supplier_name=supplier.name,
                            order_date=datetime.now().date(),
                            delivery_date=lrp_result.procurement_completion_date or (datetime.now() + timedelta(days=30)).date(),
                            order_type="标准采购",
                            tax_rate=Decimal('0.13'),
                            currency="CNY",
                            exchange_rate=Decimal('1.0'),
                            items=[
                                PurchaseOrderItemCreate(
                                    material_id=lrp_result.material_id,
                                    material_code=material.material_code,
                                    material_name=material.material_name,
                                    ordered_quantity=Decimal(str(lrp_result.planned_procurement)),
                                    unit=material.base_unit or "件",
                                    unit_price=Decimal('0.00'),  # TODO: 从价格表获取
                                    required_date=lrp_result.procurement_completion_date or (datetime.now() + timedelta(days=30)).date(),
                                    inspection_required=True,
                                )
                            ]
                        )
                        
                        purchase_order = await self.purchase_service.create_purchase_order(
                            tenant_id=tenant_id,
                            order_data=purchase_order_data,
                            created_by=created_by
                        )
                        generated_purchase_orders.append(purchase_order)
                    except Exception as e:
                        logger.error(f"生成采购单失败，物料ID: {lrp_result.material_id}, 错误: {str(e)}")
                        continue
            
            return {
                "sales_order_id": sales_order_id,
                "generated_work_orders": len(generated_work_orders),
                "generated_purchase_orders": len(generated_purchase_orders),
                "work_orders": generated_work_orders,
                "purchase_orders": generated_purchase_orders
            }

    @staticmethod
    async def _generate_plan_code(tenant_id: int, plan_type: str) -> str:
        """生成生产计划编码"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"{plan_type}{today}"
        from core.services.business.code_generation_service import CodeGenerationService
        return await CodeGenerationService.generate_code(tenant_id, f"{plan_type}_PLAN_CODE", {"prefix": prefix})
