"""
IP地址解析工具模块

提供IP地址地理位置解析、User-Agent解析等功能。
支持通过免费API获取IP地理位置信息，以及从User-Agent解析浏览器和设备信息。

Author: Luigi Lu
Date: 2025-01-11
"""

import re
from typing import Optional, Dict, Any
from loguru import logger
import httpx

from infra.infrastructure.http import get_http_client


def is_private_ip(ip: str) -> bool:
    """
    判断IP地址是否为内网IP
    
    Args:
        ip: IP地址字符串
        
    Returns:
        bool: 是否为内网IP
    """
    if not ip:
        return False
    
    # IPv4 内网地址范围
    private_ipv4_patterns = [
        r'^127\.',  # 127.0.0.0/8 - 回环地址
        r'^10\.',  # 10.0.0.0/8 - 私有网络
        r'^172\.(1[6-9]|2[0-9]|3[01])\.',  # 172.16.0.0/12 - 私有网络
        r'^192\.168\.',  # 192.168.0.0/16 - 私有网络
        r'^169\.254\.',  # 169.254.0.0/16 - 链路本地地址
    ]
    
    # IPv6 内网地址
    if '::' in ip or ip.startswith('fe80:'):
        return True
    
    # 检查IPv4内网地址
    for pattern in private_ipv4_patterns:
        if re.match(pattern, ip):
            return True
    
    return False


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
    # ⚠️ 关键修复：Edge 必须在 Chrome 之前检测，因为 Edge 的 User-Agent 也包含 Chrome
    # Edge (Chromium-based) - User-Agent 格式: "Edg/版本号"
    edge_match = re.search(r'Edg[^/]*/(\d+\.\d+)', user_agent, re.IGNORECASE)
    if edge_match:
        browser = f"Edge {edge_match.group(1)}"
    
    # Opera (Chromium-based) - User-Agent 格式: "OPR/版本号"
    opera_match = re.search(r'OPR/(\d+\.\d+)', user_agent, re.IGNORECASE)
    if opera_match:
        browser = f"Opera {opera_match.group(1)}"
    
    # Chrome (必须在 Edge 和 Opera 之后检测，因为它们也包含 Chrome)
    chrome_match = re.search(r'Chrome/(\d+\.\d+)', user_agent, re.IGNORECASE)
    if chrome_match and 'Edg' not in user_agent and 'OPR' not in user_agent:
        browser = f"Chrome {chrome_match.group(1)}"
    
    # Firefox
    firefox_match = re.search(r'Firefox/(\d+\.\d+)', user_agent, re.IGNORECASE)
    if firefox_match:
        browser = f"Firefox {firefox_match.group(1)}"
    
    # Safari (必须在 Chrome 之后检测，因为 Safari 的 User-Agent 也可能包含 Chrome)
    safari_match = re.search(r'Version/(\d+\.\d+).*Safari', user_agent, re.IGNORECASE)
    if safari_match and 'Chrome' not in user_agent:
        browser = f"Safari {safari_match.group(1)}"
    
    # 如果没有匹配到，尝试提取更具体的浏览器标识
    if not browser:
        # 尝试匹配常见的浏览器标识
        browser_patterns = [
            (r'MSIE (\d+\.\d+)', 'Internet Explorer'),
            (r'Trident/.*rv:(\d+\.\d+)', 'Internet Explorer'),
            (r'YaBrowser/(\d+\.\d+)', 'Yandex Browser'),
            (r'Vivaldi/(\d+\.\d+)', 'Vivaldi'),
            (r'Brave/(\d+\.\d+)', 'Brave'),
        ]
        
        for pattern, name in browser_patterns:
            match = re.search(pattern, user_agent, re.IGNORECASE)
            if match:
                browser = f"{name} {match.group(1)}"
                break
        
        # 如果还是没有匹配到，尝试提取第一个浏览器标识
        if not browser:
            browser_match = re.search(r'([A-Za-z]+)/(\d+\.\d+)', user_agent)
            if browser_match:
                browser = f"{browser_match.group(1)} {browser_match.group(2)}"
    
    # 解析设备类型
    user_agent_lower = user_agent.lower()
    
    # 移动设备
    if any(keyword in user_agent_lower for keyword in ['mobile', 'android', 'iphone', 'ipod']):
        device = "Mobile"
    # 平板设备
    elif any(keyword in user_agent_lower for keyword in ['tablet', 'ipad']):
        device = "Tablet"
    # 桌面设备
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
        # 使用多个免费API服务，提高成功率
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
            f"http://ip-api.com/json/{resolve_ip}?lang=zh-CN&fields=status,country,regionName,city,lat,lon",
            timeout=timeout,
        )
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "success":
                return _parse_location_from_provider(
                    data,
                    region_key="regionName",
                )
    except Exception:
        pass

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
    except Exception:
        pass

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
                return _parse_location_from_provider(
                    data,
                    loc_key="loc",
                )
    except Exception:
        pass
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


async def get_ip_location(ip: str, timeout: float = 2.0) -> Optional[str]:
    """
    获取IP地址的地理位置信息
    
    使用免费的IP地理位置API（ip-api.com）获取IP地址的地理位置。
    如果API调用失败，返回None（不影响登录流程）。
    
    Args:
        ip: IP地址字符串
        timeout: 请求超时时间（秒），默认2秒
        
    Returns:
        Optional[str]: 地理位置信息（如 "中国 北京市"），失败时返回None
    """
    if not ip or is_private_ip(ip):
        # 内网IP无法获取地理位置
        return None
    
    try:
        # 使用 ip-api.com 免费API（无需API Key，限制：45次/分钟）
        response = await get_http_client().get(
            f"http://ip-api.com/json/{ip}?lang=zh-CN&fields=status,country,regionName,city",
            timeout=timeout,
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                country = data.get("country", "")
                region = data.get("regionName", "")
                city = data.get("city", "")
                location_parts = []
                if country:
                    location_parts.append(country)
                if region and region != city:
                    location_parts.append(region)
                if city:
                    location_parts.append(city)
                if location_parts:
                    return " ".join(location_parts)

        return None

    except httpx.TimeoutException:
        logger.warning(f"IP地理位置API请求超时: {ip}")
        return None
    except Exception as e:
        # IP地理位置解析失败不影响登录流程，静默处理
        logger.debug(f"获取IP地理位置失败: {ip}, 错误: {e}")
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
    # 并行获取IP地理位置和解析User-Agent
    location = await get_ip_location(ip)
    ua_info = parse_user_agent(user_agent)
    
    return {
        "location": location,
        "browser": ua_info.get("browser"),
        "device": ua_info.get("device"),
    }
