"""
IP地址解析工具模块

提供IP地址地理位置解析、User-Agent解析等功能。
支持通过免费API获取IP地理位置信息，以及从User-Agent解析浏览器和设备信息。

Author: Luigi Lu
Date: 2025-01-11
"""

from __future__ import annotations

import ipaddress
import re
import time
from typing import Any, Dict, Optional, Tuple

from loguru import logger

from infra.infrastructure.http import get_http_client

# 成功解析结果进程内缓存（多 worker 各自一份；登录同 IP 高频命中）
_LOCATION_CACHE: Dict[str, Tuple[float, str]] = {}
_LOCATION_CACHE_TTL_SEC = 24 * 3600
_LOCATION_CACHE_MAX = 4096


def is_private_ip(ip: str) -> bool:
    """
    判断IP地址是否为内网 / 环回 / 链路本地等不可用于公网地理解析的地址。

    须用标准库 ``ipaddress``：公网 IPv6 常含 ``::`` 压缩，不可再按子串误判为内网。
    """
    if not ip:
        return False
    text = str(ip).strip()
    if not text:
        return False
    # 去掉方括号包装（偶见于代理头）
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    try:
        addr = ipaddress.ip_address(text.split("%", 1)[0])
    except ValueError:
        return False
    return bool(
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def parse_user_agent(user_agent: str) -> Dict[str, Optional[str]]:
    """
    从User-Agent字符串解析浏览器和设备信息

    Args:
        user_agent: User-Agent字符串

    Returns:
        Dict[str, Optional[str]]: 包含浏览器和设备信息的字典
            - browser: 浏览器名称和版本（如 "Chrome 120.0"）
            - device: 设备类型（PC、Mobile、Tablet等）
    """
    if not user_agent:
        return {
            "browser": None,
            "device": None,
        }

    browser = None
    device = None

    # 解析浏览器（按优先级顺序，更具体的浏览器优先）
    # ⚠️ 重要修复：Edge 必须在 Chrome 之前检测，因为 Edge 的 User-Agent 也包含 Chrome
    # Edge (Chromium-based) - User-Agent 格式: "Edg/版本号"
    edge_match = re.search(r"Edg[^/]*/(\d+\.\d+)", user_agent, re.IGNORECASE)
    if edge_match:
        browser = f"Edge {edge_match.group(1)}"

    # Opera (Chromium-based) - User-Agent 格式: "OPR/版本号"
    opera_match = re.search(r"OPR/(\d+\.\d+)", user_agent, re.IGNORECASE)
    if opera_match:
        browser = f"Opera {opera_match.group(1)}"

    # Chrome (必须在 Edge 和 Opera 之后检测，因为它们也包含 Chrome)
    chrome_match = re.search(r"Chrome/(\d+\.\d+)", user_agent, re.IGNORECASE)
    if chrome_match and "Edg" not in user_agent and "OPR" not in user_agent:
        browser = f"Chrome {chrome_match.group(1)}"

    # Firefox
    firefox_match = re.search(r"Firefox/(\d+\.\d+)", user_agent, re.IGNORECASE)
    if firefox_match:
        browser = f"Firefox {firefox_match.group(1)}"

    # Safari (必须在 Chrome 之后检测，因为 Safari 的 User-Agent 也可能包含 Chrome)
    safari_match = re.search(r"Version/(\d+\.\d+).*Safari", user_agent, re.IGNORECASE)
    if safari_match and "Chrome" not in user_agent:
        browser = f"Safari {safari_match.group(1)}"

    # 如果没有匹配到，尝试提取更具体的浏览器标识
    if not browser:
        browser_patterns = [
            (r"MSIE (\d+\.\d+)", "Internet Explorer"),
            (r"Trident/.*rv:(\d+\.\d+)", "Internet Explorer"),
            (r"YaBrowser/(\d+\.\d+)", "Yandex Browser"),
            (r"Vivaldi/(\d+\.\d+)", "Vivaldi"),
            (r"Brave/(\d+\.\d+)", "Brave"),
        ]

        for pattern, name in browser_patterns:
            match = re.search(pattern, user_agent, re.IGNORECASE)
            if match:
                browser = f"{name} {match.group(1)}"
                break

        if not browser:
            browser_match = re.search(r"([A-Za-z]+)/(\d+\.\d+)", user_agent)
            if browser_match:
                browser = f"{browser_match.group(1)} {browser_match.group(2)}"

    user_agent_lower = user_agent.lower()

    if any(keyword in user_agent_lower for keyword in ["mobile", "android", "iphone", "ipod"]):
        device = "Mobile"
    elif any(keyword in user_agent_lower for keyword in ["tablet", "ipad"]):
        device = "Tablet"
    else:
        device = "PC"

    return {
        "browser": browser,
        "device": device,
    }


async def get_public_ip() -> Optional[str]:
    """
    获取本机的公网IP地址

    通过第三方API获取本机的外网IP地址。
    如果API调用失败，返回None。

    Returns:
        Optional[str]: 公网IP地址，失败时返回None
    """
    try:
        api_services = [
            "https://api.ipify.org?format=json",
            "https://api64.ipify.org?format=json",
            "https://ifconfig.me/ip",
        ]

        client = get_http_client()
        for api_url in api_services:
            try:
                response = await client.get(api_url, timeout=3.0)
                if response.status_code != 200:
                    continue
                if "ipify" in api_url:
                    data = response.json()
                    ip = data.get("ip")
                    if ip:
                        return ip.strip()
                else:
                    ip = response.text.strip()
                    if ip:
                        return ip
            except Exception:
                continue

        return None
    except Exception as e:
        logger.debug(f"获取公网IP失败: {e}")
        return None


async def _fetch_public_ip(timeout: float = 3.0) -> Optional[str]:
    """
    获取本机公网 IP（当客户端为内网 IP 时使用）
    依次尝试 ipify、icanhazip
    """
    urls = [
        "https://api.ipify.org?format=json",
        "https://icanhazip.com",
    ]
    client = get_http_client()
    for url in urls:
        try:
            r = await client.get(url, timeout=timeout)
            if r.status_code == 200:
                text = r.text.strip()
                if "ipify" in url:
                    data = r.json()
                    return data.get("ip")
                return text if text and len(text) < 50 else None
        except Exception:
            continue
    return None


def _parse_location_from_provider(
    data: dict,
    *,
    city_key: str = "city",
    region_key: str = "region",
    country_key: str = "country",
    lat_key: str = "lat",
    lon_key: str = "lon",
    loc_key: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """从各提供商返回中解析统一格式"""
    city = (data.get(city_key) or "").strip()
    region = (data.get(region_key) or "").strip()
    country = (data.get(country_key) or "").strip()
    lat, lon = None, None
    if loc_key:
        loc = (data.get(loc_key) or "").strip()
        if loc and "," in loc:
            parts = loc.split(",", 1)
            try:
                lat, lon = float(parts[0].strip()), float(parts[1].strip())
            except (ValueError, IndexError):
                pass
    else:
        lat_val, lon_val = data.get(lat_key), data.get(lon_key)
        if lat_val is not None:
            lat = float(lat_val) if not isinstance(lat_val, (int, float)) else lat_val
        if lon_val is not None:
            lon = float(lon_val) if not isinstance(lon_val, (int, float)) else lon_val
    if city or region or country:
        return {"city": city, "region": region, "country": country, "lat": lat, "lon": lon}
    return None


def format_location_label(
    country: Optional[str] = None,
    region: Optional[str] = None,
    city: Optional[str] = None,
) -> Optional[str]:
    """登录日志地点展示：空格拼接（与 ip-api zh-CN 一致），禁止横杠造数格式。"""
    c = (country or "").strip()
    r = (region or "").strip()
    city_s = (city or "").strip()
    parts: list[str] = []
    if c:
        parts.append(c)
    if r and r != city_s and r != c:
        parts.append(r)
    if city_s and city_s != c:
        parts.append(city_s)
    return " ".join(parts) if parts else None


def _format_location_from_detail(detail: Dict[str, Any]) -> Optional[str]:
    return format_location_label(
        country=detail.get("country"),
        region=detail.get("region"),
        city=detail.get("city"),
    )


def _cache_get_location(ip: str) -> Optional[str]:
    entry = _LOCATION_CACHE.get(ip)
    if not entry:
        return None
    expires_at, label = entry
    if expires_at < time.monotonic():
        _LOCATION_CACHE.pop(ip, None)
        return None
    return label


def _cache_set_location(ip: str, label: str) -> None:
    if len(_LOCATION_CACHE) >= _LOCATION_CACHE_MAX:
        now = time.monotonic()
        expired = [k for k, (exp, _) in _LOCATION_CACHE.items() if exp < now]
        for k in expired:
            _LOCATION_CACHE.pop(k, None)
        if len(_LOCATION_CACHE) >= _LOCATION_CACHE_MAX:
            for k in list(_LOCATION_CACHE.keys())[: _LOCATION_CACHE_MAX // 2]:
                _LOCATION_CACHE.pop(k, None)
    _LOCATION_CACHE[ip] = (time.monotonic() + _LOCATION_CACHE_TTL_SEC, label)


async def _lookup_location_from_login_logs(ip: str) -> Optional[str]:
    """同 IP 曾成功解析过的地点（填补 API 瞬时失败，不造假）。"""
    try:
        from core.models.login_log import LoginLog

        row = (
            await LoginLog.filter(login_ip=ip)
            .exclude(login_location=None)
            .exclude(login_location="")
            .order_by("-created_at")
            .only("login_location")
            .first()
        )
        if row and row.login_location:
            label = str(row.login_location).strip()
            # 拒绝历史虚拟横杠格式
            if label and not label.startswith("中国-"):
                return label
    except Exception as e:
        logger.debug(f"从登录日志回查地点失败: {ip}, {e}")
    return None


async def get_ip_location_detail(ip: str, timeout: float = 3.0) -> Optional[Dict[str, Any]]:
    """
    获取IP地址的详细地理位置信息（含经纬度，供前端天气组件使用）

    当客户端 IP 为内网时，先获取本机公网 IP 再解析位置。
    依次尝试：ip-api.com、ipapi.co、ipinfo.io。

    Args:
        ip: IP地址字符串
        timeout: 请求超时时间（秒）

    Returns:
        Optional[Dict]: {"city","region","country","lat","lon"} 或 None
    """
    resolve_ip = ip
    if not ip or is_private_ip(ip):
        public = await _fetch_public_ip(timeout)
        if not public:
            return None
        resolve_ip = public

    headers = {"User-Agent": "RiverEdge/1.0"}
    client = get_http_client()

    # 1. ip-api.com
    try:
        r = await client.get(
            f"http://ip-api.com/json/{resolve_ip}?lang=zh-CN&fields=status,country,regionName,city,lat,lon,message",
            timeout=timeout,
        )
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "success":
                return _parse_location_from_provider(
                    data,
                    region_key="regionName",
                )
            if data.get("message"):
                logger.debug(f"ip-api.com 未成功: ip={resolve_ip}, message={data.get('message')}")
    except Exception as e:
        logger.debug(f"ip-api.com 请求失败: ip={resolve_ip}, {e}")

    # 2. ipapi.co (HTTPS)
    try:
        r = await client.get(
            f"https://ipapi.co/{resolve_ip}/json/",
            headers=headers,
            timeout=timeout,
        )
        if r.status_code == 200:
            data = r.json()
            if not data.get("error"):
                result = _parse_location_from_provider(
                    data,
                    country_key="country_name",
                    lat_key="latitude",
                    lon_key="longitude",
                )
                if result:
                    return result
    except Exception as e:
        logger.debug(f"ipapi.co 请求失败: ip={resolve_ip}, {e}")

    # 3. ipinfo.io (HTTPS)
    try:
        r = await client.get(
            f"https://ipinfo.io/{resolve_ip}/json",
            headers=headers,
            timeout=timeout,
        )
        if r.status_code == 200:
            data = r.json()
            if not data.get("bogon"):
                parsed = _parse_location_from_provider(
                    data,
                    loc_key="loc",
                )
                if parsed:
                    return parsed
    except Exception as e:
        logger.debug(f"ipinfo.io 请求失败: ip={resolve_ip}, {e}")
    return None


async def reverse_geocode_label(
    lat: float,
    lon: float,
    language: str = "zh",
    timeout: float = 3.0,
) -> Optional[str]:
    """
    按经纬度反查地名（供天气组件按界面语言显示城市名）。

    使用 Nominatim（OpenStreetMap）；须在后端调用以满足其 Usage Policy 与避免浏览器 CORS。
    Open-Meteo Geocoding API 仅提供 /v1/search，无 reverse 端点。
    """
    accept_lang = "zh-CN,zh" if str(language).lower().startswith("zh") else "en"
    headers = {"User-Agent": "RiverEdge/1.0 (weather; https://riveredge.local)"}
    try:
        r = await get_http_client().get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lon,
                "format": "json",
                "accept-language": accept_lang,
                "zoom": 10,
            },
            headers=headers,
            timeout=timeout,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        address = data.get("address") or {}
        for key in ("city", "town", "village", "municipality", "county", "state", "country"):
            val = address.get(key)
            if val:
                return str(val).strip()
        display = data.get("display_name")
        if display:
            return str(display).split(",")[0].strip()
    except Exception as e:
        logger.debug(f"逆地理编码失败: lat={lat}, lon={lon}, 错误: {e}")
    return None


async def get_ip_location(ip: str, timeout: float = 2.5) -> Optional[str]:
    """
    获取IP地址的地理位置文案（登录日志用）。

    路径：进程缓存 → 多源 API（与 get_ip_location_detail 同源）→ 同 IP 历史登录地点。
    失败返回 None，不阻塞登录。
    """
    if not ip or is_private_ip(ip):
        return None

    cached = _cache_get_location(ip)
    if cached:
        return cached

    detail = await get_ip_location_detail(ip, timeout=timeout)
    if detail:
        label = _format_location_from_detail(detail)
        if label:
            _cache_set_location(ip, label)
            return label

    from_log = await _lookup_location_from_login_logs(ip)
    if from_log:
        _cache_set_location(ip, from_log)
        return from_log

    return None


async def parse_ip_info(ip: str, user_agent: str = "") -> Dict[str, Optional[str]]:
    """
    解析IP地址和User-Agent的完整信息

    Args:
        ip: IP地址字符串
        user_agent: User-Agent字符串（可选）

    Returns:
        Dict[str, Optional[str]]: 包含以下字段的字典
            - location: 地理位置信息
            - browser: 浏览器信息
            - device: 设备类型
    """
    location = await get_ip_location(ip)
    ua_info = parse_user_agent(user_agent)

    return {
        "location": location,
        "browser": ua_info.get("browser"),
        "device": ua_info.get("device"),
    }
