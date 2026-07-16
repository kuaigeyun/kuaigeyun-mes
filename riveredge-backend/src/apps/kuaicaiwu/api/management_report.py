"""
管理会计报表 API 控制器
"""

from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, Optional
from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from core.api.deps.deps import get_current_user
from apps.kuaicaiwu.services.management_report_service import ManagementReportService
from apps.kuaicaiwu.services.finance_aggregation_service import FinanceAggregationService

router = APIRouter(
    prefix="/management-report",
    tags=["App - Kuaicaiwu - Management Accounting Reports"],
    dependencies=[Depends(require_kuaicaiwu_module_access("cost-report"))],
)
service = ManagementReportService()
aggregation_service = FinanceAggregationService()

@router.get("/finance-summary", summary="Finance center KPI summary")
async def get_finance_summary(
    current_user: Any = Depends(get_current_user),
):
    """财务中心：待审核收付款、逾期应收应付、业财管道摘要。"""
    from apps.kuaicaiwu.models.receivable import Receivable
    from apps.kuaicaiwu.models.payable import Payable
    from apps.kuaicaiwu.models.receipt import Receipt
    from apps.kuaicaiwu.models.payment import Payment
    import asyncio
    from datetime import date

    tenant_id = current_user.tenant_id
    today = date.today()

    r_pending, p_pending, r_overdue, p_overdue, pipeline = await asyncio.gather(
        Receipt.filter(tenant_id=tenant_id, status="Draft", deleted_at__isnull=True).count(),
        Payment.filter(tenant_id=tenant_id, status="Draft", deleted_at__isnull=True).count(),
        Receivable.filter(
            tenant_id=tenant_id,
            remaining_amount__gt=0,
            due_date__lt=today,
            deleted_at__isnull=True,
        ).count(),
        Payable.filter(
            tenant_id=tenant_id,
            remaining_amount__gt=0,
            due_date__lt=today,
            deleted_at__isnull=True,
        ).count(),
        aggregation_service.get_pipeline_summary(tenant_id),
    )

    return {
        "pending_receipts": r_pending,
        "pending_payments": p_pending,
        "overdue_receivables": r_overdue,
        "overdue_payables": p_overdue,
        **pipeline,
    }


@router.get("/kpis", summary="Financial KPIs (DSO, sales, gross margin)")
async def get_kpis(
    days: int = Query(30, description="统计天数"),
    current_user: Any = Depends(get_current_user)
):
    return await service.get_financial_kpis(current_user.tenant_id, days)

@router.get("/quality-loss", summary="Quality loss cost analysis")
async def get_quality_loss(
    days: int = Query(30, description="统计天数"),
    current_user: Any = Depends(get_current_user)
):
    return await service.get_quality_loss_analysis(current_user.tenant_id, days)

@router.get("/labor-efficiency", summary="Labor efficiency analysis")
async def get_labor_efficiency(
    days: int = Query(30, description="统计天数"),
    current_user: Any = Depends(get_current_user)
):
    return await service.get_labor_efficiency_analysis(current_user.tenant_id, days)

@router.get("/wip-valuation", summary="WIP valuation")
async def get_wip_valuation(
    current_user: Any = Depends(get_current_user)
):
    return await service.get_wip_valuation(current_user.tenant_id)

@router.get("/margin-by-product", summary="Gross margin by product")
async def get_margin_by_product(
    days: int = Query(30, description="统计天数"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    product_code: Optional[str] = Query(None, description="产品编码"),
    product_name: Optional[str] = Query(None, description="产品名称"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    sort_field: Optional[str] = Query(None, description="排序字段"),
    sort_order: Optional[str] = Query(None, description="asc 或 desc"),
    current_user: Any = Depends(get_current_user),
):
    return await service.get_margin_by_product(
        current_user.tenant_id,
        days,
        keyword=keyword,
        product_code=product_code,
        product_name=product_name,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
    )


@router.get("/margin-by-customer", summary="Gross margin by customer")
async def get_margin_by_customer(
    days: int = Query(30, description="统计天数"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    customer_name: Optional[str] = Query(None, description="客户名称"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    sort_field: Optional[str] = Query(None, description="排序字段"),
    sort_order: Optional[str] = Query(None, description="asc 或 desc"),
    current_user: Any = Depends(get_current_user),
):
    return await service.get_margin_by_customer(
        current_user.tenant_id,
        days,
        keyword=keyword,
        customer_name=customer_name,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
    )


@router.get("/margin-by-order", summary="Gross margin by sales order / delivery")
async def get_margin_by_order(
    days: int = Query(30, description="统计天数"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    sales_order_code: Optional[str] = Query(None, description="销售订单号"),
    delivery_code: Optional[str] = Query(None, description="出库单号"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    sort_field: Optional[str] = Query(None, description="排序字段"),
    sort_order: Optional[str] = Query(None, description="asc 或 desc"),
    current_user: Any = Depends(get_current_user),
):
    return await service.get_margin_by_order(
        current_user.tenant_id,
        days,
        keyword=keyword,
        sales_order_code=sales_order_code,
        delivery_code=delivery_code,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
    )


@router.get("/cost-variance/{product_id}", summary="Standard vs actual cost variance by product")
async def get_cost_variance(
    product_id: int,
    current_user: Any = Depends(get_current_user)
):
    return await service.get_cost_variance_report(current_user.tenant_id, product_id)
