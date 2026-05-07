"""
物流查询 API 模块

提供运单轨迹查询接口，供采购/销售物流跟踪使用。

Author: RiverEdge Team
Date: 2026-03-04
"""

from fastapi import APIRouter, Depends, Query
from core.api.deps import get_current_user, get_current_tenant
from core.services.logistics_service import LogisticsService

router = APIRouter(prefix="/logistics", tags=["Core · Logistics"])


@router.get("/track", summary="Track shipment")
async def track_logistics(
    carrier: str = Query(..., description="承运商/物流公司"),
    tracking_number: str = Query(..., description="运单号"),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_current_tenant),
):
    """
    根据承运商和运单号查询物流轨迹

    未配置物流API Key时返回模拟数据。
    配置 LOGISTICS_API_KEY / KUAIDI100_KEY / KDNIAO_API_KEY 可对接真实API。
    """
    return await LogisticsService.track(carrier=carrier, tracking_number=tracking_number)
