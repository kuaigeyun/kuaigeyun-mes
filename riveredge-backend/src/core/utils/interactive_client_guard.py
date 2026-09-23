"""官方客户端渠道门禁（写接口）。

- 全站写请求：中间件要求白名单 X-Client-Channel（含 integration）
- 销售订单创建：额外允许「无渠道但有上游关联」作为对接兼容（中间件关闭或豁免时仍有效）
"""

from __future__ import annotations

from typing import Any, Optional

from core.utils.client_channel import (
    CLIENT_CHANNEL_DEVICE_LABELS,
    CLIENT_CHANNEL_HEADER,
    normalize_client_channel,
)
from infra.exceptions.exceptions import AuthorizationError

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# 官方交互端 + 系统对接
_OFFICIAL_CLIENT_CHANNELS = frozenset(CLIENT_CHANNEL_DEVICE_LABELS.keys()) | frozenset({"integration"})

_SALES_ORDER_UPSTREAM_FIELDS = (
    "contract_id",
    "contract_code",
    "quotation_id",
    "sales_review_id",
    "source_quotation_id",
    "source_sales_review_id",
    "source_contract_id",
)

# 精确豁免（公开认证 / 登记激活等）
_EXEMPT_EXACT_PATHS = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/api/v1/auth/guest-login",
        "/api/v1/auth/register",
        "/api/v1/auth/register/personal",
        "/api/v1/auth/register/organization",
        "/api/v1/infra/auth/login",
        "/api/v1/infra/station-logo-license/activate",
    }
)

# 前缀豁免
_EXEMPT_PREFIXES = (
    "/api/v1/auth/biometric/",
    "/api/v1/auth/wecom/",
    "/api/v1/auth/password-",  # 忘记密码等公开流（若存在）
)


def resolve_request_client_channel(request: Any) -> Optional[str]:
    headers = getattr(request, "headers", None)
    if headers is None:
        return None
    raw = headers.get(CLIENT_CHANNEL_HEADER) or headers.get(CLIENT_CHANNEL_HEADER.lower())
    return normalize_client_channel(raw)


def request_has_official_client_channel(request: Any) -> bool:
    code = resolve_request_client_channel(request)
    if code is not None:
        return code in _OFFICIAL_CLIENT_CHANNELS
    headers = getattr(request, "headers", None)
    if headers is None:
        return False
    raw = str(
        headers.get(CLIENT_CHANNEL_HEADER) or headers.get(CLIENT_CHANNEL_HEADER.lower()) or ""
    ).strip().lower().replace("-", "_")
    return raw in _OFFICIAL_CLIENT_CHANNELS


def is_client_channel_guard_exempt_path(path: str) -> bool:
    p = (path or "").split("?", 1)[0]
    if p in _EXEMPT_EXACT_PATHS:
        return True
    for prefix in _EXEMPT_PREFIXES:
        if p.startswith(prefix):
            return True
    return False


def sales_order_create_has_upstream(data: Any) -> bool:
    if data is None:
        return False
    for name in _SALES_ORDER_UPSTREAM_FIELDS:
        val = getattr(data, name, None)
        if val is None and isinstance(data, dict):
            val = data.get(name)
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        if isinstance(val, (int, float)) and int(val) <= 0:
            continue
        return True
    return False


def assert_official_client_channel(request: Any, *, action: str = "调用写接口") -> None:
    """通用断言：无官方渠道则 403。"""
    if request_has_official_client_channel(request):
        return
    raise AuthorizationError(
        f"非官方客户端禁止{action}；"
        "请使用系统客户端（携带 X-Client-Channel），"
        "或对接时使用 X-Client-Channel: integration"
    )


def assert_allowed_sales_order_create(
    request: Any,
    *,
    has_upstream: bool,
) -> None:
    """
    销售订单创建：官方渠道放行；无渠道但有上游关联亦放行（对接兼容）。
    全站中间件开启时，无渠道请求通常已在中间件被拦；此断言作业务层兜底。
    """
    if has_upstream:
        return
    if request_has_official_client_channel(request):
        return
    raise AuthorizationError(
        "非官方客户端禁止创建无上游关联的销售订单；"
        "请使用系统客户端新建，或从报价单/合同/评审下推，"
        "或携带上游关联字段 / 使用 X-Client-Channel: integration 走正式对接"
    )
