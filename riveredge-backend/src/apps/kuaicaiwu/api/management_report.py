"""
管理会计报表 API 控制器
"""

from fastapi import APIRouter, Depends, Query
from typing import Dict, Any
from core.api.deps.deps import get_current_user
from apps.kuaicaiwu.services.management_report_service import ManagementReportService

router = APIRouter(prefix="/management-report", tags=["管理会计报表"])
service = ManagementReportService()

@router.get("/kpis", summary="获取财务关键KPI (DSO/销售/毛利)")
async def get_kpis(
    days: int = Query(30, description="统计天数"),
    current_user: Any = Depends(get_current_user)
):
    return await service.get_financial_kpis(current_user.tenant_id, days)

@router.get("/quality-loss", summary="获取质量损失成本分析")
async def get_quality_loss(
    days: int = Query(30, description="统计天数"),
    current_user: Any = Depends(get_current_user)
):
    return await service.get_quality_loss_analysis(current_user.tenant_id, days)

@router.get("/labor-efficiency", summary="获取人工效能分析")
async def get_labor_efficiency(
    days: int = Query(30, description="统计天数"),
    current_user: Any = Depends(get_current_user)
):
    return await service.get_labor_efficiency_analysis(current_user.tenant_id, days)

@router.get("/wip-valuation", summary="获取WIP在制品估值")
async def get_wip_valuation(
    current_user: Any = Depends(get_current_user)
):
    return await service.get_wip_valuation(current_user.tenant_id)

@router.get("/cost-variance/{product_id}", summary="获取特定产品的标准与实际成本差异")
async def get_cost_variance(
    product_id: int,
    current_user: Any = Depends(get_current_user)
):
    return await service.get_cost_variance_report(current_user.tenant_id, product_id)
