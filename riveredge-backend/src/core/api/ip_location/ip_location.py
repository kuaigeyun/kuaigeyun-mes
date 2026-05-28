"""
IP 定位 API

供前端天气组件获取当前用户 IP 对应的地理位置，避免 Mixed Content（HTTPS 页面请求 HTTP）。
"""

from typing import Optional

from fastapi import APIRouter, Request, Depends

from core.utils.ip_parser import get_ip_location_detail, reverse_geocode_label
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/ip-location", tags=["Core · IP Location"])


def _get_client_ip(request: Request) -> Optional[str]:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return None


@router.get("")
async def get_ip_location(
    request: Request,
    _user: User = Depends(get_current_user),
):
    """
    获取当前请求 IP 的地理位置（供工作台天气组件使用）
    
    后端代理调用 ip-api.com，避免前端 HTTPS 页面的 Mixed Content 问题。
    """
    ip = _get_client_ip(request)
    if not ip:
        return {"city": "", "region": "", "country": "", "lat": None, "lon": None}
    detail = await get_ip_location_detail(ip)
    if detail:
        return detail
    return {"city": "", "region": "", "country": "", "lat": None, "lon": None}


@router.get("/reverse")
async def get_reverse_geocode(
    latitude: float,
    longitude: float,
    language: str = "zh",
    _user: User = Depends(get_current_user),
):
    """
    按经纬度反查地名（工作台天气组件切换语言时使用）。

    后端代理 Nominatim，避免浏览器 CORS 及 Open-Meteo 无 reverse 端点的问题。
    """
    name = await reverse_geocode_label(latitude, longitude, language=language)
    return {"name": name or ""}
