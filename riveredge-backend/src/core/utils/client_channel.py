"""
客户端渠道（登录设备）解析。

各端在登录等请求中携带 ``X-Client-Channel``，后端优先据此写入登录日志的
``login_device``；未携带时回退 User-Agent 粗分（PC / Mobile / Tablet）。
"""

from __future__ import annotations

from typing import Any, Optional

CLIENT_CHANNEL_HEADER = "X-Client-Channel"

# 渠道码 → 登录日志展示文案（唯一真源）
CLIENT_CHANNEL_DEVICE_LABELS: dict[str, str] = {
    "pc": "PC端",
    "station": "触屏工位",
    "android": "安卓端",
    "ios": "iOS端",
    "mobile_h5": "手机H5",
    "miniprogram": "微信小程序",
}


def normalize_client_channel(raw: Optional[str]) -> Optional[str]:
    code = str(raw or "").strip().lower().replace("-", "_")
    if not code:
        return None
    if code in CLIENT_CHANNEL_DEVICE_LABELS:
        return code
    # 兼容常见别名
    aliases = {
        "web": "pc",
        "desktop": "pc",
        "touch": "station",
        "touchscreen": "station",
        "kiosk": "station",
        "expo_android": "android",
        "expo_ios": "ios",
        "h5": "mobile_h5",
        "mobile": "mobile_h5",
        "wechat": "miniprogram",
        "weixin": "miniprogram",
        "mp": "miniprogram",
    }
    return aliases.get(code)


def client_channel_device_label(channel: Optional[str]) -> Optional[str]:
    code = normalize_client_channel(channel)
    if not code:
        return None
    return CLIENT_CHANNEL_DEVICE_LABELS.get(code)


def resolve_login_device_from_request(
    request: Any,
    *,
    ua_device_fallback: Optional[str] = None,
) -> Optional[str]:
    """优先读 X-Client-Channel，否则回退 UA 解析结果。"""
    headers = getattr(request, "headers", None)
    raw = None
    if headers is not None:
        raw = headers.get(CLIENT_CHANNEL_HEADER) or headers.get(CLIENT_CHANNEL_HEADER.lower())
    label = client_channel_device_label(raw)
    if label:
        return label
    return ua_device_fallback
