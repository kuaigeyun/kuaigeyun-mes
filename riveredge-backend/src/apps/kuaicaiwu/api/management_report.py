"""
管理会计报表 API 控制器
"""

from fastapi import APIRouter, Depends, Query
from typing import Dict, Any
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_user
from apps.kuaicaiwu.services.management_report_service import ManagementReportService

router = APIRouter(
    prefix="/management-report",
    tags=["App · Kuaicaiwu · Management Accounting Reports"],
    dependencies=[Depends(require_module_access("kuaicaiwu", "cost-report"))],
)
service = ManagementReportService()

@router.get("/finance-summary", summary="Finance center KPI summary")
async def get_finance_summary(
    current_user: Any = Depends(get_current_user),
):
    """财务中心：待审核收付款、逾期应收应付。"""
    from apps.kuaicaiwu.models.receivable import Receivable
    from apps.kuaicaiwu.models.payable import Payable
    from apps.kuaicaiwu.models.receipt import Receipt
    from apps.kuaicaiwu.models.payment import Payment
    import asyncio
    from datetime import date

    tenant_id = current_user.tenant_id
    today = date.today()
    pending_review = ["待审核", "PENDING_REVIEW", "pending"]

    r_pending, p_pending, r_overdue, p_overdue = await asyncio.gather(
        Receipt.filter(tenant_id=tenant_id, review_status__in=pending_review, deleted_at__isnull=True).count(),
        Payment.filter(tenant_id=tenant_id, review_status__in=pending_review, deleted_at__isnull=True).count(),
        Receivable.filter(tenant_id=tenant_id, status="未收款", due_date__lt=today, deleted_at__isnull=True).count(),
        Payable.filter(tenant_id=tenant_id, status="未付款", due_date__lt=today, deleted_at__isnull=True).count(),
    )

    return {
        "pending_receipts": r_pending,
        "pending_payments": p_pending,
        "overdue_receivables": r_overdue,
        "overdue_payables": p_overdue,
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

@router.get("/cost-variance/{product_id}", summary="Standard vs actual cost variance by product")
async def get_cost_variance(
    product_id: int,
    current_user: Any = Depends(get_current_user)
):
    return await service.get_cost_variance_report(current_user.tenant_id, product_id)
