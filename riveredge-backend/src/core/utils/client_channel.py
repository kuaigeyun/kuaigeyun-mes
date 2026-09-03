"""
客户端渠道（登录设备）解析。

各端在登录等请求中携带 ``X-Client-Channel``，后端优先据此写入登录日志的
``login_device``；未携带时回退 User-Agent 粗分（PC / Mobile / Tablet）。
报工记录同样写入归一化渠道码 ``client_channel``（与登录同源，禁止另起一套）。
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

# 报工列表「报工来源」聚合展示（口语：小程序 / App / 终端 / PC）
REPORTING_CLIENT_CHANNEL_SOURCE_LABELS: dict[str, str] = {
    "miniprogram": "小程序",
    "android": "App",
    "ios": "App",
    "mobile_h5": "App",
    "station": "终端",
    "pc": "PC",
}

REPORT_MODE_SELF = "self"
REPORT_MODE_PROXY = "proxy"
REPORT_MODE_TEAM = "team"

REPORT_MODE_LABELS: dict[str, str] = {
    REPORT_MODE_SELF: "自报",
    REPORT_MODE_PROXY: "代报",
    REPORT_MODE_TEAM: "小组报工",
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


def reporting_client_channel_source_label(channel: Optional[str]) -> Optional[str]:
    """报工来源聚合文案；无码时返回 None（列表展示空，禁止猜）。"""
    code = normalize_client_channel(channel)
    if not code:
        return None
    return REPORTING_CLIENT_CHANNEL_SOURCE_LABELS.get(code)


def resolve_client_channel_code_from_request(request: Any) -> Optional[str]:
    """从请求头读取并归一化渠道码（供报工等业务落库）。"""
    headers = getattr(request, "headers", None)
    raw = None
    if headers is not None:
        raw = headers.get(CLIENT_CHANNEL_HEADER) or headers.get(CLIENT_CHANNEL_HEADER.lower())
    return normalize_client_channel(raw)


def resolve_report_mode(
    *,
    team_id: Any,
    worker_id: Any,
    recorded_by: Any,
) -> str:
    """与代报权限判定一致：小组 → team；生产人员≠提交人 → proxy；否则 self。"""
    if team_id is not None:
        return REPORT_MODE_TEAM
    try:
        wid = int(worker_id) if worker_id is not None else None
    except (TypeError, ValueError):
        wid = None
    try:
        rid = int(recorded_by) if recorded_by is not None else None
    except (TypeError, ValueError):
        rid = None
    if wid is None or rid is None or wid != rid:
        return REPORT_MODE_PROXY
    return REPORT_MODE_SELF


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
