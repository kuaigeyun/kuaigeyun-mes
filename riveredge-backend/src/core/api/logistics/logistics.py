"""
物流查询 API 模块

提供运单轨迹查询接口。凭证来自快递查询连接器，或云市场连接器且场景为快递轨迹查询。
"""

from fastapi import APIRouter, Depends, Query
from core.api.deps import get_current_user, get_current_tenant
from core.services.logistics_service import LogisticsService
from core.services.amap_geocode_service import amap_map_public_config

router = APIRouter(prefix="/logistics", tags=["Core - Logistics"])


@router.get("/map-config", summary="Amap map public config")
async def get_amap_map_config(
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_current_tenant),
):
    """返回前端加载高德 JS 所需公开配置（不含 REST Key）。"""
    return await amap_map_public_config(tenant_id)


@router.get("/track", summary="Track shipment")
async def track_logistics(
    carrier: str = Query("", description="承运商编码或名称"),
    tracking_number: str = Query(..., description="运单号"),
    phone: str = Query("", description="收件人或寄件人手机号（阿里云快递查询必填；顺丰/中通亦须填，可后四位）"),
    current_user=Depends(get_current_user),
    tenant_id=Depends(get_current_tenant),
):
    """按承运商与运单号查询快递轨迹（走最近启用的物流连接器）。"""
    return await LogisticsService.track(
        carrier=carrier,
        tracking_number=tracking_number,
        tenant_id=tenant_id,
        phone=phone,
    )
