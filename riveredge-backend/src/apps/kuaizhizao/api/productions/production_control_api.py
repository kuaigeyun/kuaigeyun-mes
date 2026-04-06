"""
生产计划管控塔 API 控制器
"""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from typing import List
from core.api.deps import get_current_user
from apps.kuaizhizao.services.production_control_service import ProductionControlService
from apps.kuaizhizao.schemas.production_control import (
    MaterialReadinessItem, ResourceLoadItem, DeliveryRiskItem, ControlTowerSummary,
    BulkReleaseRequest, UrgentOrderSimulationRequest, SimulationResult
)
from apps.kuaizhizao.models.work_order import WorkOrder

router = APIRouter(prefix="/production-control", tags=["生产计划管控塔"])
service = ProductionControlService()


@router.get("/readiness", response_model=List[MaterialReadinessItem])
async def get_material_readiness(
    current_user=Depends(get_current_user)
):
    """获取全局齐套性分析"""
    return await service.get_global_material_readiness(current_user.tenant_id)


@router.get("/resource-load", response_model=List[ResourceLoadItem])
async def get_resource_load(
    days: int = Query(14, description="分析天数"),
    current_user=Depends(get_current_user)
):
    """获取工作中心资源负荷分析"""
    return await service.get_resource_load_analysis(current_user.tenant_id, days)


@router.get("/risks", response_model=List[DeliveryRiskItem])
async def get_delivery_risks(
    current_user=Depends(get_current_user)
):
    """获取交期风险预警"""
    return await service.get_delivery_risk_orders(current_user.tenant_id)


@router.get("/summary", response_model=ControlTowerSummary)
async def get_control_tower_summary(
    current_user=Depends(get_current_user)
):
    """获取管控塔核心指标汇总"""
    tenant_id = current_user.tenant_id
    
    # 并行获取各项指标，大幅缩短加载响应时间
    import asyncio
    
    # 定义待并行执行的任务
    readiness_task = service.get_global_material_readiness(tenant_id)
    load_task = service.get_resource_load_analysis(tenant_id)
    risks_task = service.get_delivery_risk_orders(tenant_id)
    wip_count_task = WorkOrder.filter(
        tenant_id=tenant_id,
        status__in=['released', 'in_progress'],
        deleted_at__isnull=True
    ).count()

    try:
        readiness, load, risks, total_wip = await asyncio.gather(
            readiness_task, load_task, risks_task, wip_count_task
        )
    except Exception as e:
        logger.error(f"Error fetching control tower summary: {e}")
        # 返回降级数据
        return {
            "material_readiness": [],
            "resource_load": [],
            "delivery_risks": [],
            "total_wip_orders": 0
        }
    
    return ControlTowerSummary(
        material_readiness=readiness,
        resource_load=load,
        delivery_risks=risks,
        total_wip_count=total_wip,
        total_risk_count=len(risks)
    )


@router.post("/release-kitted")
async def bulk_release_kitted_orders(
    req: BulkReleaseRequest,
    current_user=Depends(get_current_user)
):
    """批量下达齐套工单"""
    return await service.release_kitted_work_orders(
        current_user.tenant_id, 
        req.work_order_ids, 
        operator_id=current_user.id
    )


@router.post("/simulate-impact", response_model=SimulationResult)
async def simulate_urgent_order_impact(
    req: UrgentOrderSimulationRequest,
    current_user=Depends(get_current_user)
):
    """紧急订单插单影响模拟"""
    return await service.simulate_urgent_order_impact(current_user.tenant_id, req.dict())
