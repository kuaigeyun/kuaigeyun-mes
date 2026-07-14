"""
报表 API 路由模块

提供各类报表分析的API接口。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Body
from fastapi.responses import FileResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError

from apps.kuaizhizao.services.report_service import ReportService

# 初始化服务实例
report_service = ReportService()

# 创建路由
router = APIRouter(prefix="/reports", tags=["App · Kuaige Zhizao · Reports"])


async def _execute_report(coro):
    """统一执行报表查询并序列化响应，异常写入日志便于排查 500。"""
    try:
        result = await coro
        if isinstance(result, dict):
            return report_service._wrap_report_payload(result)
        return result
    except ValidationError:
        raise
    except Exception as exc:
        logger.exception("报表查询失败: {}", exc)
        raise


@router.get("/inventory/statistics", summary="Inventory statistics (KPI cards)")
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

        agg = await report_service._aggregate_sums(batch_query, {"total_qty": "quantity"})
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


@router.get("/inventory", summary="Inventory report")
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

    return await _execute_report(
        report_service.get_inventory_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
            warehouse_id=warehouse_id,
        )
    )


@router.get("/inventory/batch-query", summary="Batch inventory query")
async def query_batch_inventory(
    material_id: Optional[int] = Query(None, description="物料ID（与 material_ids 二选一）"),
    material_ids: Optional[List[int]] = Query(None, description="物料ID列表（批量查询，与 material_id 二选一）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    batch_number: Optional[str] = Query(None, description="批号"),
    include_expired: bool = Query(False, description="是否包含过期批次"),
    include_zero_stock: bool = Query(True, description="是否包含0库存记录"),
    summary_only: bool = Query(False, description="是否仅返回物料汇总（material_totals），用于批量检查"),
    aggregate_by_material: bool = Query(False, description="是否按物料聚合返回（用于即时库存查询）"),
    include_summary: bool = Query(False, description="是否返回汇总指标（summary）"),
    group_by: Optional[str] = Query(None, description="分析分组维度（warehouse/material/status/aging_bucket）"),
    include_sales_commitment: bool = Query(False, description="是否扣减销售已承诺未交付数量（用于ATP动态可承诺）"),
    ownership_type: Optional[str] = Query(None, description="库存归属过滤（company_owned/customer_provided）"),
    customer_id: Optional[int] = Query(None, description="客供归属客户ID（自购传 0）"),
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
    - **include_sales_commitment**: 是否扣减销售承诺量（默认：否）
    - **ownership_type** / **customer_id**: 库存归属过滤（出库预览与过账扣减对齐时传 company_owned + 0）
    
    返回每个批次的库存数量、生产日期、有效期等信息；
    summary_only 时返回 { material_totals: { material_id: quantity } }；
    aggregate_by_material=true 时返回按物料聚合后的 items（不按批次拆分）。
    """
    return await report_service.query_batch_inventory(
        tenant_id=tenant_id,
        material_id=material_id,
        material_ids=material_ids,
        warehouse_id=warehouse_id,
        batch_number=batch_number,
        include_expired=include_expired,
        include_zero_stock=include_zero_stock,
        summary_only=summary_only,
        aggregate_by_material=aggregate_by_material,
        include_summary=include_summary,
        group_by=group_by,
        include_sales_commitment=include_sales_commitment,
        ownership_type=ownership_type,
        customer_id=customer_id,
    )


@router.get("/inventory/material-balances", summary="On-hand inventory by material/warehouse")
async def get_inventory_material_balances(
    material_id: Optional[int] = Query(None, description="物料ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    include_zero_stock: bool = Query(True, description="是否包含0库存"),
    status_filter: Optional[str] = Query(None, description="状态筛选（in_stock/zero/expired）"),
    keyword: Optional[str] = Query(None, description="关键词（物料编码/名称/仓库）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    current: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=500, description="每页条数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    return await report_service.get_inventory_material_balances(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id,
        include_zero_stock=include_zero_stock,
        status_filter=status_filter,
        keyword=keyword,
        order_by=order_by,
        current=current,
        page_size=page_size,
    )


@router.get("/inventory/material-balances/summary", summary="On-hand inventory KPI summary")
async def get_inventory_material_balances_summary(
    material_id: Optional[int] = Query(None, description="物料ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    include_zero_stock: bool = Query(True, description="是否包含0库存"),
    status_filter: Optional[str] = Query(None, description="状态筛选（in_stock/zero/expired）"),
    keyword: Optional[str] = Query(None, description="关键词"),
    group_by: str = Query("warehouse", description="分组维度（warehouse/material/status/aging_bucket）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    return await report_service.get_inventory_material_balances_summary(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id,
        include_zero_stock=include_zero_stock,
        status_filter=status_filter,
        keyword=keyword,
        group_by=group_by,
    )


@router.get("/inventory/batch-lines", summary="Batch stock lines")
async def get_inventory_batch_lines(
    material_id: Optional[int] = Query(None, description="物料ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    batch_number: Optional[str] = Query(None, description="批号"),
    include_expired: bool = Query(False, description="是否包含过期批次"),
    include_zero_stock: bool = Query(True, description="是否包含0库存"),
    aging_bucket: Optional[str] = Query(None, description="库龄筛选（expired/0-30/31-90/90+）"),
    status_filter: Optional[str] = Query(None, description="状态筛选（in_stock/zero/expired）"),
    keyword: Optional[str] = Query(None, description="关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    current: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=500, description="每页条数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    return await report_service.get_inventory_batch_lines(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id,
        batch_number=batch_number,
        include_expired=include_expired,
        include_zero_stock=include_zero_stock,
        aging_bucket=aging_bucket,
        status_filter=status_filter,
        keyword=keyword,
        order_by=order_by,
        current=current,
        page_size=page_size,
    )


@router.get("/inventory/batch-lines/summary", summary="Batch stock KPI summary")
async def get_inventory_batch_lines_summary(
    material_id: Optional[int] = Query(None, description="物料ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    batch_number: Optional[str] = Query(None, description="批号"),
    include_expired: bool = Query(False, description="是否包含过期批次"),
    include_zero_stock: bool = Query(True, description="是否包含0库存"),
    aging_bucket: Optional[str] = Query(None, description="库龄筛选（expired/0-30/31-90/90+）"),
    status_filter: Optional[str] = Query(None, description="状态筛选（in_stock/zero/expired）"),
    keyword: Optional[str] = Query(None, description="关键词"),
    group_by: str = Query("aging_bucket", description="分组维度（warehouse/material/status/aging_bucket）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    return await report_service.get_inventory_batch_lines_summary(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id,
        batch_number=batch_number,
        include_expired=include_expired,
        include_zero_stock=include_zero_stock,
        aging_bucket=aging_bucket,
        status_filter=status_filter,
        keyword=keyword,
        group_by=group_by,
    )


@router.get("/sales", summary="Sales report")
async def get_sales_report(
    report_type: str = Query("summary", description="报表类型（summary/execution/customer_summary/product_ranking 等）"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    customer_id: Optional[int] = Query(None, description="客户ID"),
    customer_keyword: Optional[str] = Query(None, description="客户名称模糊筛选（用于客户业绩汇总等）"),
    skip: int = Query(0, ge=0, description="分页偏移"),
    limit: int = Query(100, ge=1, le=500, description="分页条数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取销售报表数据

    支持多种报表类型：
    - summary: 销售订单综合查询统计
    - execution: 销售订单执行跟踪统计
    - customer_summary: 客户销售业绩汇总
    - product_ranking: 产品销售排行榜

    - **report_type**: 报表类型
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **customer_id**: 客户ID（可选）
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

    return await _execute_report(
        report_service.get_sales_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
            customer_id=customer_id,
            skip=skip,
            limit=limit,
            customer_keyword=customer_keyword,
            current_user=current_user,
        )
    )
    
@router.get("/plans", summary="Planning report")
async def get_plan_report(
    report_type: str = Query("fulfillment", description="报表类型"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
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
    return await _execute_report(
        report_service.get_plan_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
            current_user=current_user,
        )
    )

@router.get("/purchases", summary="Purchase report")
async def get_purchase_report(
    report_type: str = Query("requisition_tracking", description="报表类型"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    skip: int = Query(0, ge=0, description="分页偏移"),
    limit: int = Query(100, ge=1, le=500, description="分页条数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
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
    return await _execute_report(
        report_service.get_purchase_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
            skip=skip,
            limit=limit,
            current_user=current_user,
        )
    )

@router.get("/quality", summary="Quality report")
async def get_quality_report(
    report_type: str = Query("analysis", description="报表类型"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    skip: int = Query(0, ge=0, description="分页偏移"),
    limit: int = Query(100, ge=1, le=500, description="分页条数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
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
    return await _execute_report(
        report_service.get_quality_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
            skip=skip,
            limit=limit,
        )
    )

@router.get("/equipment", summary="Equipment report")
async def get_equipment_report(
    report_type: str = Query("maintenance", description="报表类型"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
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
    return await _execute_report(
        report_service.get_equipment_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
    )

@router.get("/warehouse", summary="Warehouse reports")
async def get_warehouse_report(
    report_type: str = Query("inbound_summary", description="报表类型"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    skip: int = Query(0, ge=0, description="分页偏移"),
    limit: int = Query(100, ge=1, le=500, description="分页条数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
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
    return await _execute_report(
        report_service.get_warehouse_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
            skip=skip,
            limit=limit,
        )
    )

@router.get("/performance", summary="Performance report")
async def get_performance_report(
    report_type: str = Query("employee-efficiency-ranking", description="报表类型"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
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
    return await _execute_report(
        report_service.get_performance_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
    )


@router.get("/production", summary="Production report")
async def get_production_report(
    report_type: str = Query("efficiency", description="报表类型"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    work_center_id: Optional[int] = Query(None, description="工作中心ID"),
    skip: int = Query(0, ge=0, description="分页偏移"),
    limit: int = Query(100, ge=1, le=500, description="分页条数"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段（前缀-表示降序）"),
    status: Optional[str] = Query(None, description="状态筛选"),
    order_code: Optional[str] = Query(None, description="单号模糊筛选"),
    product_name: Optional[str] = Query(None, description="产品名称模糊筛选"),
    supplier_name: Optional[str] = Query(None, description="供应商名称模糊筛选"),
    work_order_code: Optional[str] = Query(None, description="工单号模糊筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
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
    return await _execute_report(
        report_service.get_production_report(
            tenant_id=tenant_id,
            report_type=report_type,
            date_start=date_start_dt,
            date_end=date_end_dt,
            work_center_id=work_center_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            order_by=order_by,
            status=status,
            order_code=order_code,
            product_name=product_name,
            supplier_name=supplier_name,
            work_order_code=work_order_code,
        )
    )


@router.post("/{domain}/export", summary="Export report data (CSV)")
async def export_domain_report(
    domain: str,
    body: Dict[str, Any] = Body(default_factory=dict),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FileResponse:
    """
    统一报表导出：与列表接口相同的 filter body（report_type、date_start、date_end 等）。
    """
    report_type = str(body.get("report_type") or body.get("reportType") or "summary")
    date_start_dt = None
    date_end_dt = None
    date_start = body.get("date_start") or body.get("startDate")
    date_end = body.get("date_end") or body.get("endDate")

    if date_start:
        try:
            date_start_dt = datetime.strptime(str(date_start)[:10], "%Y-%m-%d")
        except ValueError:
            raise ValidationError("开始日期格式错误，应为YYYY-MM-DD")
    if date_end:
        try:
            date_end_dt = datetime.strptime(str(date_end)[:10], "%Y-%m-%d")
        except ValueError:
            raise ValidationError("结束日期格式错误，应为YYYY-MM-DD")

    file_path = await report_service.export_domain_report(
        tenant_id=tenant_id,
        domain=domain,
        report_type=report_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
        warehouse_id=body.get("warehouse_id") or body.get("filters", {}).get("warehouse_id"),
        customer_id=body.get("customer_id") or body.get("filters", {}).get("customer_id"),
        customer_keyword=body.get("customer_keyword"),
        material_id=body.get("material_id") or body.get("filters", {}).get("material_id"),
        current_user=current_user,
    )
    filename = file_path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return FileResponse(
        file_path,
        media_type="text/csv",
        filename=filename,
    )
