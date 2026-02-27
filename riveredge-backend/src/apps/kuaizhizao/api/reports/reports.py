"""
报表 API 路由模块

提供各类报表分析的API接口。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError

from apps.kuaizhizao.services.report_service import ReportService

# 初始化服务实例
report_service = ReportService()

# 创建路由
router = APIRouter(prefix="/reports", tags=["报表"])


@router.get("/inventory/statistics", summary="获取库存统计（用于指标卡片）")
async def get_inventory_statistics(
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    返回库存各维度统计，用于报表页指标卡片。
    数据来源：MaterialBatch（批次库存）、InventoryAlert（库存预警）。
    """
    from apps.master_data.models.material_batch import MaterialBatch
    from apps.kuaizhizao.models.inventory_alert import InventoryAlert
    from tortoise.functions import Sum

    try:
        batch_query = MaterialBatch.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, quantity__gt=0, status="in_stock"
        )
        material_ids = await batch_query.values_list("material_id", flat=True)
        total_materials = len(set(material_ids)) if material_ids else 0

        agg = await batch_query.aggregate(total_qty=Sum("quantity"))
        total_quantity = float(agg.get("total_qty") or 0)
    except Exception as e:
        logger.warning(f"inventory-statistics batch: {e}")
        total_materials = 0
        total_quantity = 0.0

    try:
        alert_base = InventoryAlert.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending")
        if warehouse_id:
            alert_base = alert_base.filter(warehouse_id=warehouse_id)

        low_stock_alerts = alert_base.filter(alert_type="low_stock")
        out_of_stock_count = await low_stock_alerts.filter(current_quantity=0).count()
        low_stock_count = await low_stock_alerts.filter(current_quantity__gt=0).count()
        high_stock_count = await alert_base.filter(alert_type="high_stock").count()
    except Exception as e:
        logger.warning(f"inventory-statistics alert: {e}")
        low_stock_count = 0
        out_of_stock_count = 0
        high_stock_count = 0

    return {
        "total_items": total_materials,
        "total_quantity": round(total_quantity, 2),
        "total_value": 0.0,
        "low_stock_items": low_stock_count,
        "out_of_stock_items": out_of_stock_count,
        "high_stock_items": high_stock_count,
        "normal_stock_items": max(0, total_materials - low_stock_count - out_of_stock_count - high_stock_count),
    }


@router.get("/inventory", summary="获取库存报表")
async def get_inventory_report(
    report_type: str = Query("summary", description="报表类型（summary/turnover/abc/slow_moving）"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取库存报表数据

    支持多种报表类型：
    - summary: 库存状况分析
    - turnover: 库存周转率报表
    - abc: ABC分析报表
    - slow_moving: 呆滞料分析报表

    - **report_type**: 报表类型
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **warehouse_id**: 仓库ID（可选）
    """
    date_start_dt = None
    date_end_dt = None

    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("开始日期格式错误，应为YYYY-MM-DD")

    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("结束日期格式错误，应为YYYY-MM-DD")

    return await report_service.get_inventory_report(
        tenant_id=tenant_id,
        report_type=report_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
        warehouse_id=warehouse_id,
    )


@router.get("/inventory/batch-query", summary="批次库存查询")
async def query_batch_inventory(
    material_id: Optional[int] = Query(None, description="物料ID（与 material_ids 二选一）"),
    material_ids: Optional[List[int]] = Query(None, description="物料ID列表（批量查询，与 material_id 二选一）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    batch_number: Optional[str] = Query(None, description="批号"),
    include_expired: bool = Query(False, description="是否包含过期批次"),
    summary_only: bool = Query(False, description="是否仅返回物料汇总（material_totals），用于批量检查"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    批次库存查询
    
    查询库存按批次分组的详细信息，支持多种筛选条件：
    - **material_id**: 物料ID（可选，与 material_ids 二选一）
    - **material_ids**: 物料ID列表（可选，批量查询，summary_only 时返回 material_totals）
    - **warehouse_id**: 仓库ID（可选）
    - **batch_number**: 批号（可选）
    - **include_expired**: 是否包含过期批次（默认：否）
    - **summary_only**: 是否仅返回物料汇总（默认：否）
    
    返回每个批次的库存数量、生产日期、有效期等信息；summary_only 时返回 { material_totals: { material_id: quantity } }。
    """
    return await report_service.query_batch_inventory(
        tenant_id=tenant_id,
        material_id=material_id,
        material_ids=material_ids,
        warehouse_id=warehouse_id,
        batch_number=batch_number,
        include_expired=include_expired,
        summary_only=summary_only,
    )
