"""
工作台Dashboard API模块

提供工作台相关的API接口，包括待办事项、统计数据等。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from datetime import datetime

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.exception_service import ExceptionService
from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
from apps.kuaizhizao.models.delivery_delay_exception import DeliveryDelayException
from apps.kuaizhizao.models.quality_exception import QualityException
from apps.kuaizhizao.models.inventory_alert import InventoryAlert
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.rework_order import ReworkOrder
from loguru import logger

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class TodoItem(BaseModel):
    """待办事项项"""
    id: str = Field(..., description="待办事项ID")
    type: str = Field(..., description="待办事项类型（work_order/approval/exception）")
    title: str = Field(..., description="待办事项标题")
    description: Optional[str] = Field(None, description="待办事项描述")
    priority: str = Field(..., description="优先级（high/medium/low）")
    due_date: Optional[datetime] = Field(None, description="截止日期")
    status: str = Field(..., description="状态（pending/in_progress/completed）")
    link: Optional[str] = Field(None, description="跳转链接")
    created_at: datetime = Field(..., description="创建时间")


class TodoListResponse(BaseModel):
    """待办事项列表响应"""
    items: List[TodoItem] = Field(default_factory=list, description="待办事项列表")
    total: int = Field(0, description="总数")


class StatisticsResponse(BaseModel):
    """统计数据响应"""
    production: dict = Field(default_factory=dict, description="生产统计")
    inventory: dict = Field(default_factory=dict, description="库存统计")
    quality: dict = Field(default_factory=dict, description="质量统计")


class DashboardResponse(BaseModel):
    """工作台数据响应"""
    todos: TodoListResponse = Field(..., description="待办事项")
    statistics: StatisticsResponse = Field(..., description="统计数据")


@router.get("/todos", response_model=TodoListResponse, summary="获取待办事项列表")
async def get_todos(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
) -> TodoListResponse:
    """
    获取待办事项列表
    
    包括：
    - 待处理工单
    - 待审核单据
    - 异常提醒
    """
    todos = []
    
    try:
        # 1. 获取待处理工单（状态为released或in_progress的工单）
        work_orders = await WorkOrderService().list_work_orders(
            tenant_id=tenant_id,
            status="released",
            skip=0,
            limit=limit,
        )
        
        for wo in work_orders:
            todos.append(TodoItem(
                id=f"work_order_{wo.id}",
                type="work_order",
                title=f"处理工单 {wo.code}",
                description=f"产品：{wo.product_name}，数量：{wo.quantity}",
                priority="medium",  # 工单列表响应中没有priority字段，默认medium
                due_date=wo.planned_end_date,
                status="pending",
                link=f"/apps/kuaizhizao/production-execution/work-orders/{wo.id}",
                created_at=wo.created_at,
            ))
    except Exception as e:
        logger.error(f"获取待处理工单失败: {e}")
    
    try:
        # 2. 获取异常提醒（缺料异常、延期异常、质量异常）
        exception_service = ExceptionService()
        
        # 获取缺料异常
        material_shortages = await MaterialShortageException.filter(
            tenant_id=tenant_id,
            status="open",
        ).limit(limit)
        
        for exc in material_shortages:
            todos.append(TodoItem(
                id=f"exception_material_{exc.id}",
                type="exception",
                title=f"缺料异常：{exc.material_name}",
                description=f"缺料数量：{exc.shortage_quantity}，工单：{exc.work_order_code}",
                priority=exc.alert_level or "medium",
                due_date=None,
                status="pending",
                link=f"/apps/kuaizhizao/material-shortage-exceptions/{exc.id}",
                created_at=exc.created_at,
            ))
        
        # 获取延期异常
        delivery_delays = await DeliveryDelayException.filter(
            tenant_id=tenant_id,
            status="open",
        ).limit(limit)
        
        for exc in delivery_delays:
            todos.append(TodoItem(
                id=f"exception_delay_{exc.id}",
                type="exception",
                title=f"延期异常：{exc.work_order_code}",
                description=f"延期天数：{exc.delay_days}天",
                priority="high",
                due_date=None,
                status="pending",
                link=f"/apps/kuaizhizao/delivery-delay-exceptions/{exc.id}",
                created_at=exc.created_at,
            ))
        
        # 获取质量异常
        quality_exceptions = await QualityException.filter(
            tenant_id=tenant_id,
            status="open",
        ).limit(limit)
        
        for exc in quality_exceptions:
            todos.append(TodoItem(
                id=f"exception_quality_{exc.id}",
                type="exception",
                title=f"质量异常：{exc.title}",
                description=exc.description,
                priority=exc.severity or "medium",
                due_date=None,
                status="pending",
                link=f"/apps/kuaizhizao/quality-exceptions/{exc.id}",
                created_at=exc.created_at,
            ))
    except Exception as e:
        logger.error(f"获取异常提醒失败: {e}")
    
    # 3. TODO: 获取待审核单据（需要审批流程模块支持）
    
    # 按优先级和创建时间排序
    todos.sort(key=lambda x: (
        {"high": 0, "medium": 1, "low": 2}.get(x.priority, 3),
        x.created_at
    ))
    
    return TodoListResponse(
        items=todos[:limit],
        total=len(todos),
    )


@router.post("/todos/{todo_id}/handle", summary="处理待办事项")
async def handle_todo(
    todo_id: str,
    action: str = Query("handle", description="处理动作（handle: 跳转处理, ignore: 忽略）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    处理待办事项
    
    根据待办事项类型执行相应的处理动作。
    工单和异常待办事项返回跳转链接，实际处理在对应的详情页完成。
    
    - **todo_id**: 待办事项ID（格式：work_order_{id} 或 exception_material_{id} 等）
    - **action**: 处理动作（handle: 处理/跳转, ignore: 忽略）
    """
    # 解析待办事项ID
    if todo_id.startswith("work_order_"):
        # 工单待办事项：返回跳转链接
        work_order_id = int(todo_id.replace("work_order_", ""))
        return {
            "success": True,
            "message": "请前往工单详情页进行处理",
            "todo_id": todo_id,
            "redirect": f"/apps/kuaizhizao/production-execution/work-orders/{work_order_id}",
        }
    elif todo_id.startswith("exception_material_"):
        # 缺料异常：返回跳转链接
        exception_id = int(todo_id.replace("exception_material_", ""))
        return {
            "success": True,
            "message": "请前往缺料异常详情页进行处理",
            "todo_id": todo_id,
            "redirect": f"/apps/kuaizhizao/exceptions/material-shortage/{exception_id}",
        }
    elif todo_id.startswith("exception_delay_"):
        # 延期异常：返回跳转链接
        exception_id = int(todo_id.replace("exception_delay_", ""))
        return {
            "success": True,
            "message": "请前往延期异常详情页进行处理",
            "todo_id": todo_id,
            "redirect": f"/apps/kuaizhizao/exceptions/delivery-delay/{exception_id}",
        }
    elif todo_id.startswith("exception_quality_"):
        # 质量异常：返回跳转链接
        exception_id = int(todo_id.replace("exception_quality_", ""))
        return {
            "success": True,
            "message": "请前往质量异常详情页进行处理",
            "todo_id": todo_id,
            "redirect": f"/apps/kuaizhizao/exceptions/quality/{exception_id}",
        }
    else:
        return {
            "success": False,
            "message": f"未知的待办事项类型: {todo_id}",
            "todo_id": todo_id,
        }


@router.get("/statistics", response_model=StatisticsResponse, summary="获取统计数据")
async def get_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StatisticsResponse:
    """
    获取统计数据
    
    包括：
    - 生产统计（工单数量、完成率、在制品数量、订单数、商品数、生产计划数、完工数量、不良品率、产能达成率等）
    - 库存统计（库存总量、库存周转率、预警数量等）
    - 质量统计（合格率、不良品数量、质量异常数量等）
    """
    from datetime import datetime, timedelta
    
    # 解析时间范围
    date_start_dt = None
    date_end_dt = None
    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            pass
    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
            # 结束日期包含整天，所以设置为当天的23:59:59
            date_end_dt = date_end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            pass
    
    statistics = StatisticsResponse()
    
    try:
        # 生产统计
        from apps.kuaizhizao.services.reporting_service import ReportingService
        from apps.kuaizhizao.services.defect_record_service import DefectRecordService
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.work_order import WorkOrder
        from decimal import Decimal
        
        # 获取工单统计
        work_order_query = WorkOrder.filter(tenant_id=tenant_id)
        if date_start_dt:
            work_order_query = work_order_query.filter(created_at__gte=date_start_dt)
        if date_end_dt:
            work_order_query = work_order_query.filter(created_at__lte=date_end_dt)
        
        work_orders = await work_order_query.all()
        
        total_work_orders = len(work_orders)
        completed_work_orders = len([wo for wo in work_orders if wo.status == "completed"])
        in_progress_work_orders = len([wo for wo in work_orders if wo.status == "in_progress"])
        
        # 计算完工数量（已完成工单的计划数量总和，WorkOrder 使用 quantity 表示计划数量）
        completed_quantity = sum(
            float(wo.quantity) for wo in work_orders 
            if wo.status == "completed" and wo.quantity
        )
        
        # 获取订单统计
        sales_order_query = SalesOrder.filter(tenant_id=tenant_id)
        if date_start_dt:
            sales_order_query = sales_order_query.filter(created_at__gte=date_start_dt)
        if date_end_dt:
            sales_order_query = sales_order_query.filter(created_at__lte=date_end_dt)
        
        sales_orders = await sales_order_query.all()
        order_count = len(sales_orders)
        
        # 计算商品数（订单中不同商品的数量）
        product_codes = set()
        for so in sales_orders:
            if hasattr(so, 'items') and so.items:
                for item in so.items:
                    if hasattr(item, 'product_code'):
                        product_codes.add(item.product_code)
        product_count = len(product_codes)
        
        # 计算生产计划数（所有工单的计划数量总和，WorkOrder 使用 quantity 表示计划数量）
        plan_quantity = sum(
            float(wo.quantity) for wo in work_orders 
            if wo.quantity
        )
        
        # 获取报工统计，计算不良品率
        reporting_service = ReportingService()
        reporting_stats = await reporting_service.get_reporting_statistics(
            tenant_id=tenant_id,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
        
        total_reported_quantity = float(reporting_stats.get("total_reported_quantity", 0)) if reporting_stats else 0
        total_unqualified_quantity = float(reporting_stats.get("total_unqualified_quantity", 0)) if reporting_stats else 0
        defect_rate = (total_unqualified_quantity / total_reported_quantity * 100) if total_reported_quantity > 0 else 0
        
        # 计算产能达成率（实际完工数量 / 计划数量 * 100）
        capacity_achievement_rate = (completed_quantity / plan_quantity * 100) if plan_quantity > 0 else 0
        
        statistics.production = {
            "total": total_work_orders,
            "completed": completed_work_orders,
            "in_progress": in_progress_work_orders,
            "completion_rate": round(completed_work_orders / total_work_orders * 100, 2) if total_work_orders > 0 else 0,
            "order_count": order_count,
            "product_count": product_count,
            "plan_quantity": round(plan_quantity, 2),
            "completed_quantity": round(completed_quantity, 2),
            "defect_rate": round(defect_rate, 2),
            "capacity_achievement_rate": round(capacity_achievement_rate, 2),
        }
    except Exception as e:
        logger.error(f"获取生产统计失败: {e}")
        statistics.production = {
            "total": 0,
            "completed": 0,
            "in_progress": 0,
            "completion_rate": 0,
            "order_count": 0,
            "product_count": 0,
            "plan_quantity": 0,
            "completed_quantity": 0,
            "defect_rate": 0,
            "capacity_achievement_rate": 0,
        }
    
    try:
        # 库存统计
        # 获取库存预警数量
        alert_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            status="open",
        ).count()
        
        # TODO: 实现完整的库存统计逻辑（总数量、总价值、周转率等）
        # 当前先返回预警数量
        statistics.inventory = {
            "total_quantity": 0,
            "total_value": 0,
            "turnover_rate": 0,
            "alert_count": alert_count,
        }
    except Exception as e:
        logger.error(f"获取库存统计失败: {e}")
        statistics.inventory = {
            "total_quantity": 0,
            "total_value": 0,
            "turnover_rate": 0,
            "alert_count": 0,
        }
    
    try:
        # 质量统计
        from apps.kuaizhizao.services.reporting_service import ReportingService
        
        # 获取质量异常统计
        quality_exceptions = await QualityException.filter(
            tenant_id=tenant_id,
        ).all()
        
        open_quality_exceptions = await QualityException.filter(
            tenant_id=tenant_id,
            status="open",
        ).all()
        
        # 获取报工统计，计算合格率
        reporting_service = ReportingService()
        reporting_stats = await reporting_service.get_reporting_statistics(
            tenant_id=tenant_id,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
        
        quality_rate = reporting_stats.get("qualification_rate", 0) if reporting_stats else 0
        
        statistics.quality = {
            "total_exceptions": len(quality_exceptions),
            "open_exceptions": len(open_quality_exceptions),
            "quality_rate": round(quality_rate, 2),
        }
    except Exception as e:
        logger.error(f"获取质量统计失败: {e}")
        statistics.quality = {
            "total_exceptions": 0,
            "open_exceptions": 0,
            "quality_rate": 0,
        }
    
    return statistics


class ProcessProgressItem(BaseModel):
    """工序执行进展项"""
    process_id: str = Field(..., description="工序ID（工序编码）")
    process_name: str = Field(..., description="工序名称")
    current_progress: float = Field(..., description="当前进度（百分比）")
    task_count: int = Field(..., description="生产任务数")
    planned_quantity: float = Field(..., description="计划数")
    qualified_quantity: float = Field(..., description="合格数")
    unqualified_quantity: float = Field(..., description="不合格数")
    status: str = Field(..., description="状态（not_started/in_progress/completed）")


class ProcessProgressResponse(BaseModel):
    """工序执行进展响应"""
    items: List[ProcessProgressItem] = Field(default_factory=list, description="工序执行进展列表")


@router.get("/process-progress", response_model=ProcessProgressResponse, summary="获取工序执行进展")
async def get_process_progress(
    include_unstarted: bool = Query(False, description="是否包含未开始生产任务"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessProgressResponse:
    """
    获取在制工序执行进展
    
    按工序名称分组，统计每个工序的执行情况。
    
    - **include_unstarted**: 是否包含未开始生产任务（默认：False）
    """
    from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
    from apps.kuaizhizao.models.work_order import WorkOrder
    from decimal import Decimal
    from collections import defaultdict
    
    try:
        # 查询在制工序（pending或in_progress状态）
        query = WorkOrderOperation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        
        if include_unstarted:
            # 包含未开始的任务
            query = query.filter(status__in=["pending", "in_progress"])
        else:
            # 只包含进行中的任务
            query = query.filter(status="in_progress")
        
        operations = await query.all()
        
        # 按工序名称分组统计
        process_stats = defaultdict(lambda: {
            "process_id": "",
            "process_name": "",
            "task_count": 0,
            "planned_quantity": Decimal("0"),
            "completed_quantity": Decimal("0"),
            "qualified_quantity": Decimal("0"),
            "unqualified_quantity": Decimal("0"),
            "statuses": set(),
        })
        
        # 获取所有相关的工单ID
        work_order_ids = list(set([op.work_order_id for op in operations]))
        
        # 批量获取工单信息（用于获取计划数量）
        work_orders = {}
        if work_order_ids:
            wo_list = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=work_order_ids,
            ).all()
            work_orders = {wo.id: wo for wo in wo_list}
        
        # 统计每个工序的数据
        for op in operations:
            process_key = op.operation_name or op.operation_code
            if not process_key:
                continue
            
            stats = process_stats[process_key]
            stats["process_id"] = op.operation_code or str(op.operation_id)
            stats["process_name"] = op.operation_name or op.operation_code
            stats["task_count"] += 1
            
            # 获取工单的计划数量（工单的quantity就是该工序的计划数量）
            work_order = work_orders.get(op.work_order_id)
            if work_order:
                stats["planned_quantity"] += work_order.quantity or Decimal("0")
            
            # 累计完成数量、合格数量、不合格数量
            stats["completed_quantity"] += op.completed_quantity or Decimal("0")
            stats["qualified_quantity"] += op.qualified_quantity or Decimal("0")
            stats["unqualified_quantity"] += op.unqualified_quantity or Decimal("0")
            stats["statuses"].add(op.status)
        
        # 转换为响应格式
        items = []
        for process_name, stats in process_stats.items():
            # 计算当前进度（已完成数量 / 计划数量 * 100）
            planned_qty = float(stats["planned_quantity"])
            completed_qty = float(stats["completed_quantity"])
            current_progress = (completed_qty / planned_qty * 100) if planned_qty > 0 else 0.0
            
            # 确定状态
            statuses = stats["statuses"]
            if "in_progress" in statuses:
                status = "in_progress"
            elif "pending" in statuses:
                status = "not_started"
            else:
                status = "completed"
            
            items.append(ProcessProgressItem(
                process_id=stats["process_id"],
                process_name=stats["process_name"],
                current_progress=round(current_progress, 2),
                task_count=stats["task_count"],
                planned_quantity=round(planned_qty, 2),
                qualified_quantity=round(float(stats["qualified_quantity"]), 2),
                unqualified_quantity=round(float(stats["unqualified_quantity"]), 2),
                status=status,
            ))
        
        # 按工序名称排序
        items.sort(key=lambda x: x.process_name)
        
        return ProcessProgressResponse(items=items)
        
    except Exception as e:
        logger.error(f"获取工序执行进展失败: {e}")
        import traceback
        traceback.print_exc()
        return ProcessProgressResponse(items=[])


class ManagementMetricsResponse(BaseModel):
    """管理指标响应"""
    average_production_cycle: float = Field(..., description="平均订单生产周期（天）")
    on_time_delivery_rate: float = Field(..., description="准交率（%）")


@router.get("/management-metrics", response_model=ManagementMetricsResponse, summary="获取管理指标")
async def get_management_metrics(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ManagementMetricsResponse:
    """
    获取管理指标
    
    包括：
    - 平均订单生产周期（天）：从工单创建到完成的平均天数
    - 准交率（%）：按时交付的订单占比
    """
    from datetime import datetime, timedelta
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.sales_order import SalesOrder
    
    # 解析时间范围
    date_start_dt = None
    date_end_dt = None
    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            pass
    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
            date_end_dt = date_end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            pass
    
    try:
        # 计算平均订单生产周期
        # 查询已完成的工单
        work_order_query = WorkOrder.filter(
            tenant_id=tenant_id,
            status="completed",
            actual_start_date__isnull=False,
            actual_end_date__isnull=False,
        )
        
        if date_start_dt:
            work_order_query = work_order_query.filter(actual_end_date__gte=date_start_dt)
        if date_end_dt:
            work_order_query = work_order_query.filter(actual_end_date__lte=date_end_dt)
        
        completed_work_orders = await work_order_query.all()
        
        total_cycle_days = 0
        valid_orders = 0
        
        for wo in completed_work_orders:
            if wo.actual_start_date and wo.actual_end_date:
                cycle_days = (wo.actual_end_date - wo.actual_start_date).days
                if cycle_days >= 0:  # 确保是有效的时间差
                    total_cycle_days += cycle_days
                    valid_orders += 1
        
        average_production_cycle = (total_cycle_days / valid_orders) if valid_orders > 0 else 0.0
        
        # 计算准交率
        # 查询销售订单（已完成或已交付的订单）
        sales_order_query = SalesOrder.filter(
            tenant_id=tenant_id,
        ).filter(
            status__in=["completed", "delivered", "closed"]
        )
        
        if date_start_dt:
            sales_order_query = sales_order_query.filter(created_at__gte=date_start_dt)
        if date_end_dt:
            sales_order_query = sales_order_query.filter(created_at__lte=date_end_dt)
        
        sales_orders = await sales_order_query.all()
        
        on_time_count = 0
        total_delivered_count = 0
        
        for so in sales_orders:
            # 检查是否有交付日期字段
            if hasattr(so, 'delivery_date') and so.delivery_date:
                planned_delivery = so.delivery_date
                # 实际交付日期：使用updated_at作为交付时间（订单完成/交付时更新时间）
                actual_delivery = so.updated_at
                
                # 将delivery_date转换为date类型（如果是datetime则提取date部分）
                if isinstance(planned_delivery, datetime):
                    planned_delivery_date = planned_delivery.date()
                else:
                    planned_delivery_date = planned_delivery
                
                if actual_delivery:
                    actual_delivery_date = actual_delivery.date() if isinstance(actual_delivery, datetime) else actual_delivery
                    # 按时交付：实际交付日期 <= 计划交付日期
                    if actual_delivery_date <= planned_delivery_date:
                        on_time_count += 1
                    total_delivered_count += 1
        
        on_time_delivery_rate = (on_time_count / total_delivered_count * 100) if total_delivered_count > 0 else 0.0
        
        return ManagementMetricsResponse(
            average_production_cycle=round(average_production_cycle, 2),
            on_time_delivery_rate=round(on_time_delivery_rate, 2),
        )
        
    except Exception as e:
        logger.error(f"获取管理指标失败: {e}")
        import traceback
        traceback.print_exc()
        return ManagementMetricsResponse(
            average_production_cycle=0.0,
            on_time_delivery_rate=0.0,
        )


class ProductionBroadcastItem(BaseModel):
    """生产实时播报项"""
    id: str = Field(..., description="播报ID")
    operator_name: str = Field(..., description="操作员姓名")
    process_name: str = Field(..., description="工序名称")
    date: str = Field(..., description="日期")
    work_order_no: str = Field(..., description="工单号")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    qualified_quantity: float = Field(..., description="合格数")
    unqualified_quantity: float = Field(..., description="不合格数")
    created_at: str = Field(..., description="创建时间")


class ProductionBroadcastResponse(BaseModel):
    """生产实时播报响应"""
    items: List[ProductionBroadcastItem] = Field(default_factory=list, description="播报列表")


@router.get("/production-broadcast", response_model=ProductionBroadcastResponse, summary="获取生产实时播报")
async def get_production_broadcast(
    limit: int = Query(10, ge=1, le=50, description="返回数量限制"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionBroadcastResponse:
    """
    获取生产实时播报
    
    返回最近的报工记录，用于实时展示生产活动。
    
    - **limit**: 返回数量限制（默认10条，最多50条）
    """
    from apps.kuaizhizao.models.reporting_record import ReportingRecord
    from apps.kuaizhizao.models.work_order import WorkOrder
    from datetime import datetime, timedelta
    
    try:
        # 查询最近的报工记录（最近7天）
        date_threshold = datetime.now() - timedelta(days=7)
        
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            status__in=["approved", "pending"],  # 显示已审核和待审核的报工记录
        ).order_by("-reported_at").limit(limit).all()
        
        # 获取相关的工单信息
        work_order_ids = list(set([r.work_order_id for r in reporting_records if r.work_order_id]))
        work_orders = {}
        if work_order_ids:
            wo_list = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=work_order_ids,
            ).all()
            work_orders = {wo.id: wo for wo in wo_list}
        
        items = []
        for record in reporting_records:
            work_order = work_orders.get(record.work_order_id) if record.work_order_id else None
            
            items.append(ProductionBroadcastItem(
                id=str(record.id),
                operator_name=record.worker_name or "未知操作员",
                process_name=record.operation_name or "未知工序",
                date=record.reported_at.strftime("%Y-%m-%d") if record.reported_at else datetime.now().strftime("%Y-%m-%d"),
                work_order_no=record.work_order_code or (work_order.code if work_order else "未知工单"),
                product_code=work_order.product_code if work_order else "未知产品",
                product_name=work_order.product_name if work_order else "未知产品",
                qualified_quantity=float(record.qualified_quantity or 0),
                unqualified_quantity=float(record.unqualified_quantity or 0),
                created_at=record.reported_at.isoformat() if record.reported_at else datetime.now().isoformat(),
            ))
        
        return ProductionBroadcastResponse(items=items)
        
    except Exception as e:
        logger.error(f"获取生产实时播报失败: {e}")
        import traceback
        traceback.print_exc()
        return ProductionBroadcastResponse(items=[])


@router.get("/menu-badge-counts", summary="获取左侧菜单业务单据未完成数量（用于徽标）")
async def get_menu_badge_counts(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    返回各业务单据的「未完成」数量，key 与前端菜单 path 映射一致。
    用于左侧菜单业务类单据显示数量小徽标。
    """
    counts = {}
    try:
        # 工单：已下达 + 进行中
        counts["work_order"] = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=["released", "in_progress"],
            deleted_at__isnull=True,
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts work_order: {e}")
        counts["work_order"] = 0
    try:
        # 返工单：已下达 + 进行中
        counts["rework_order"] = await ReworkOrder.filter(
            tenant_id=tenant_id,
            status__in=["released", "in_progress"],
            deleted_at__isnull=True,
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts rework_order: {e}")
        counts["rework_order"] = 0
    try:
        # 异常（待处理）：缺料 + 延期 + 质量
        c1 = await MaterialShortageException.filter(tenant_id=tenant_id, status="open").count()
        c2 = await DeliveryDelayException.filter(tenant_id=tenant_id, status="open").count()
        c3 = await QualityException.filter(tenant_id=tenant_id, status="open").count()
        counts["exception"] = c1 + c2 + c3
    except Exception as e:
        logger.warning(f"menu-badge-counts exception: {e}")
        counts["exception"] = 0
    try:
        # 销售订单：活动状态（排除草稿、已完成、已取消、已驳回）
        from apps.kuaizhizao.models.sales_order import SalesOrder
        counts["sales_order"] = await SalesOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).exclude(
            status__in=["DRAFT", "草稿", "CANCELLED", "已取消"],
        ).exclude(
            review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts sales_order: {e}")
        counts["sales_order"] = 0
    try:
        # 采购订单：待审核（兼容 PENDING、PENDING_REVIEW、待审核 等存量数据）
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder
        counts["purchase_order"] = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            review_status__in=["PENDING", "PENDING_REVIEW", "待审核"],
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts purchase_order: {e}")
        counts["purchase_order"] = 0
    try:
        # 采购入库：待入库
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        counts["inbound"] = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="待入库",
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts inbound: {e}")
        counts["inbound"] = 0
    try:
        # 质检：待检验（来料+过程+成品）
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
        c1 = await IncomingInspection.filter(
            tenant_id=tenant_id, deleted_at__isnull=True,
            status="待检验",
        ).count()
        c2 = await ProcessInspection.filter(
            tenant_id=tenant_id, deleted_at__isnull=True,
            status="待检验",
        ).count()
        c3 = await FinishedGoodsInspection.filter(
            tenant_id=tenant_id, deleted_at__isnull=True,
            status="待检验",
        ).count()
        counts["quality_inspection"] = c1 + c2 + c3
    except Exception as e:
        logger.warning(f"menu-badge-counts quality_inspection: {e}")
        counts["quality_inspection"] = 0
    try:
        # 生产计划：未执行
        from apps.kuaizhizao.models.production_plan import ProductionPlan
        counts["production_plan"] = await ProductionPlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            execution_status="未执行",
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts production_plan: {e}")
        counts["production_plan"] = 0
    try:
        # 设备：维修中、校验中
        from apps.kuaizhizao.models.equipment import Equipment
        counts["equipment"] = await Equipment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=["维修中", "校验中"],
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts equipment: {e}")
        counts["equipment"] = 0
    try:
        # 模具：维修中、校验中
        from apps.kuaizhizao.models.mold import Mold
        counts["mold"] = await Mold.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=["维修中", "校验中"],
        ).count()
    except Exception as e:
        logger.warning(f"menu-badge-counts mold: {e}")
        counts["mold"] = 0
    return counts


@router.get("", response_model=DashboardResponse, summary="获取工作台数据")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DashboardResponse:
    """
    获取工作台数据
    
    整合待办事项和统计数据
    """
    todos = await get_todos(current_user=current_user, tenant_id=tenant_id)
    statistics = await get_statistics(current_user=current_user, tenant_id=tenant_id)
    
    return DashboardResponse(
        todos=todos,
        statistics=statistics,
    )

