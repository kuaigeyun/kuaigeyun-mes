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
from apps.kuaizhizao.services.warehouse_service import WarehouseService
from apps.kuaizhizao.services.production_service import ProductionService
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
        # 1. 获取待处理工单
        work_orders = await WorkOrderService().list_work_orders(
            tenant_id=tenant_id,
            status="released",
            limit=limit,
        )
        
        for wo in work_orders:
            todos.append(TodoItem(
                id=f"work_order_{wo.id}",
                type="work_order",
                title=f"处理工单 {wo.work_order_no}",
                description=f"产品：{wo.product_name}，数量：{wo.quantity}",
                priority="high" if wo.priority == "urgent" else "medium",
                due_date=wo.planned_end_date,
                status="pending",
                link=f"/apps/kuaizhizao/work-orders/{wo.id}",
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
    action: str = Query(..., description="处理动作"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    处理待办事项
    
    根据待办事项类型执行相应的处理动作
    """
    # 解析待办事项ID
    if todo_id.startswith("work_order_"):
        work_order_id = int(todo_id.replace("work_order_", ""))
        # TODO: 执行工单处理逻辑
        return {"message": "工单处理成功", "todo_id": todo_id}
    elif todo_id.startswith("exception_"):
        exception_id = int(todo_id.replace("exception_", ""))
        # TODO: 执行异常处理逻辑
        return {"message": "异常处理成功", "todo_id": todo_id}
    else:
        return {"message": "未知的待办事项类型", "todo_id": todo_id}


@router.get("/statistics", response_model=StatisticsResponse, summary="获取统计数据")
async def get_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StatisticsResponse:
    """
    获取统计数据
    
    包括：
    - 生产统计（工单数量、完成率、在制品数量等）
    - 库存统计（库存总量、库存周转率、预警数量等）
    - 质量统计（合格率、不良品数量、质量异常数量等）
    """
    statistics = StatisticsResponse()
    
    try:
        # 生产统计
        work_orders = await WorkOrderService().list_work_orders(
            tenant_id=tenant_id,
            limit=1000,
        )
        
        total_work_orders = len(work_orders)
        completed_work_orders = len([wo for wo in work_orders if wo.status == "completed"])
        in_progress_work_orders = len([wo for wo in work_orders if wo.status == "in_progress"])
        
        statistics.production = {
            "total": total_work_orders,
            "completed": completed_work_orders,
            "in_progress": in_progress_work_orders,
            "completion_rate": round(completed_work_orders / total_work_orders * 100, 2) if total_work_orders > 0 else 0,
        }
    except Exception as e:
        logger.error(f"获取生产统计失败: {e}")
        statistics.production = {
            "total": 0,
            "completed": 0,
            "in_progress": 0,
            "completion_rate": 0,
        }
    
    try:
        # 库存统计
        # TODO: 实现库存统计逻辑
        statistics.inventory = {
            "total_quantity": 0,
            "total_value": 0,
            "turnover_rate": 0,
            "alert_count": 0,
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
        quality_exceptions = await QualityException.filter(
            tenant_id=tenant_id,
        ).all()
        
        open_quality_exceptions = await QualityException.filter(
            tenant_id=tenant_id,
            status="open",
        ).all()
        
        statistics.quality = {
            "total_exceptions": len(quality_exceptions),
            "open_exceptions": len(open_quality_exceptions),
            "quality_rate": 95.5,  # TODO: 从质量数据计算
        }
    except Exception as e:
        logger.error(f"获取质量统计失败: {e}")
        statistics.quality = {
            "total_exceptions": 0,
            "open_exceptions": 0,
            "quality_rate": 0,
        }
    
    return statistics


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

