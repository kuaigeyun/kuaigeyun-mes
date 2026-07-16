"""
生产计划管控塔 API 控制器
"""

from typing import List

from fastapi import APIRouter, Depends, Query

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.production_control import (
    BulkReleaseRequest,
    ControlTowerStats,
    ControlTowerSummary,
    DeliveryRiskItem,
    MaterialReadinessItem,
    ResourceLoadItem,
    SimulationResult,
    UrgentOrderSimulationRequest,
)
from apps.kuaizhizao.services.production_control_service import ProductionControlService
from core.api.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/production-control", tags=["App - Kuaige Zhizao - Production Planning Control"])
service = ProductionControlService()


@router.get("/readiness", response_model=List[MaterialReadinessItem])
async def get_material_readiness(
    _user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取全局齐套性分析"""
    return await service.get_global_material_readiness(tenant_id)


@router.get("/resource-load", response_model=List[ResourceLoadItem])
async def get_resource_load(
    days: int = Query(14, description="分析天数"),
    _user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取工作中心资源负荷分析"""
    return await service.get_resource_load_analysis(tenant_id, days)


@router.get("/risks", response_model=List[DeliveryRiskItem])
async def get_delivery_risks(
    _user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取交期风险预警"""
    return await service.get_delivery_risk_orders(tenant_id)


@router.get("/summary", response_model=ControlTowerSummary)
async def get_control_tower_summary(
    _user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取管控塔核心指标汇总"""
    import asyncio

    readiness_task = service.get_global_material_readiness(tenant_id)
    load_task = service.get_resource_load_analysis(tenant_id)
    risks_task = service.get_delivery_risk_orders(tenant_id)
    wip_count_task = WorkOrder.filter(
        tenant_id=tenant_id,
        status__in=["released", "in_progress"],
        deleted_at__isnull=True,
    ).count()

    readiness, load, risks, total_wip = await asyncio.gather(
        readiness_task, load_task, risks_task, wip_count_task
    )

    from apps.kuaizhizao.models.demand_computation import DemandComputation

    comp_total = await DemandComputation.filter(tenant_id=tenant_id).count()
    comp_pending = await DemandComputation.filter(
        tenant_id=tenant_id, computation_status="进行中"
    ).count()
    comp_done = await DemandComputation.filter(
        tenant_id=tenant_id, computation_status="完成"
    ).count()
    overdue_count = len(
        [
            r
            for r in risks
            if (getattr(r, "risk_type", None) if not isinstance(r, dict) else r.get("risk_type"))
            == "delayed"
        ]
    )

    stats = ControlTowerStats(
        total_count=comp_total,
        pending_review_count=comp_pending,
        executed_count=comp_done,
        overdue_plans_count=overdue_count,
    )

    return ControlTowerSummary(
        material_readiness=readiness,
        resource_load=load,
        delivery_risks=risks,
        total_wip_count=total_wip,
        total_risk_count=len(risks),
        stats=stats,
    )


@router.post("/release-kitted")
async def bulk_release_kitted_orders(
    req: BulkReleaseRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量下达齐套工单"""
    return await service.release_kitted_work_orders(
        tenant_id,
        req.work_order_ids,
        operator_id=current_user.id,
    )


@router.post("/simulate-impact", response_model=SimulationResult)
async def simulate_urgent_order_impact(
    req: UrgentOrderSimulationRequest,
    _user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """紧急订单插单影响模拟"""
    return await service.simulate_urgent_order_impact(tenant_id, req.dict())
