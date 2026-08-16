"""
高德地图地理编码服务（唯一真源）

租户 Key 来自应用连接器 type=amap；未配置时返回 None，禁止猜测坐标。
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

import httpx
from loguru import logger

from core.models.integration_config import IntegrationConfig


class AmapGeocodeError(Exception):
    """地理编码失败（配置缺失或高德返回错误）"""


async def resolve_tenant_amap_config(tenant_id: int) -> Dict[str, str]:
    """读取租户已启用的「高德地图」应用连接器配置。"""
    row = (
        await IntegrationConfig.filter(
            tenant_id=tenant_id,
            type="amap",
            is_active=True,
            deleted_at__isnull=True,
        )
        .order_by("-updated_at")
        .first()
    )
    if not row or not isinstance(row.config, dict):
        return {"js_key": "", "security_code": "", "rest_key": ""}
    cfg = row.config
    return {
        "js_key": str(cfg.get("js_key") or "").strip(),
        "security_code": str(cfg.get("security_code") or "").strip(),
        "rest_key": str(cfg.get("rest_key") or "").strip(),
    }


async def geocode_address(
    address: str,
    *,
    tenant_id: int,
    rest_key: Optional[str] = None,
) -> Optional[Tuple[float, float]]:
    """
    将地址文本转为 (lng, lat)。失败返回 None，不抛错（业务层决定是否阻断）。
    """
    text = (address or "").strip()
    if not text:
        return None
    key = (rest_key or "").strip()
    if not key:
        cfg = await resolve_tenant_amap_config(tenant_id)
        key = cfg.get("rest_key") or ""
    if not key:
        return None
    url = "https://restapi.amap.com/v3/geocode/geo"
    params = {"key": key, "address": text}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:
        logger.warning("高德地理编码请求失败 address={} err={}", text, exc)
        return None
    if str(payload.get("status")) != "1":
        logger.warning("高德地理编码失败 address={} info={}", text, payload.get("info"))
        return None
    geocodes = payload.get("geocodes") or []
    if not geocodes:
        return None
    location = str(geocodes[0].get("location") or "").strip()
    if not location or "," not in location:
        return None
    lng_s, lat_s = location.split(",", 1)
    try:
        lng = float(lng_s)
        lat = float(lat_s)
    except ValueError:
        return None
    return lng, lat


async def amap_js_configured(tenant_id: int) -> bool:
    cfg = await resolve_tenant_amap_config(tenant_id)
    return bool(cfg.get("js_key"))


async def amap_map_public_config(tenant_id: int) -> dict:
    cfg = await resolve_tenant_amap_config(tenant_id)
    js_key = cfg.get("js_key") or ""
    security_code = cfg.get("security_code") or ""
    return {
        "configured": bool(js_key),
        "js_key": js_key or None,
        "security_code": security_code or None,
    }


async def test_amap_connection_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """测试高德 REST Key 是否可用（地理编码探测）。"""
    rest_key = str(config.get("rest_key") or "").strip()
    js_key = str(config.get("js_key") or "").strip()
    if not js_key:
        return {"success": False, "message": "请填写 JS API Key"}
    if not rest_key:
        return {"success": False, "message": "请填写 Web 服务 REST Key"}
    coords = await geocode_address("北京市朝阳区", tenant_id=0, rest_key=rest_key)
    if coords is None:
        return {"success": False, "message": "REST Key 无效或地理编码不可用，请检查 Key 与配额"}
    return {"success": True, "message": "高德地图 Key 校验通过"}
