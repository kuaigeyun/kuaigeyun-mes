"""
移动端 H5 容器 JSAPI 签名（企微 / 钉钉 / 飞书）。

供多端共用 H5 调起宿主扫码；ticket 进程内缓存，避免触达平台频控。
"""

from __future__ import annotations

import hashlib
import secrets
import time
from dataclasses import dataclass
from typing import Any, Literal, Optional

from core.models.integration_config import IntegrationConfig
from core.services.integration.wecom_integration import (
    WECOM_API_BASE,
    fetch_wecom_access_token,
    get_wecom_credentials,
)
from infra.infrastructure.http.client import get_http_client

JsapiProvider = Literal["wecom", "dingtalk", "feishu"]

_TICKET_CACHE: dict[str, tuple[str, float]] = {}


@dataclass(frozen=True)
class MobileJsapiSignature:
    provider: JsapiProvider
    corp_id: Optional[str]
    agent_id: Optional[int]
    app_id: Optional[str]
    timestamp: int
    nonce_str: str
    signature: str
    agent_signature: Optional[str] = None


def _cache_get(key: str) -> Optional[str]:
    hit = _TICKET_CACHE.get(key)
    if not hit:
        return None
    ticket, expire_at = hit
    if time.time() >= expire_at:
        _TICKET_CACHE.pop(key, None)
        return None
    return ticket


def _cache_set(key: str, ticket: str, expires_in: int) -> None:
    # 提前 120s 过期，避免边界失败
    ttl = max(60, int(expires_in) - 120)
    _TICKET_CACHE[key] = (ticket, time.time() + ttl)


def _sha1_sign(ticket: str, nonce: str, timestamp: int, url: str) -> str:
    raw = f"jsapi_ticket={ticket}&noncestr={nonce}&timestamp={timestamp}&url={url}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def normalize_jsapi_url(url: str) -> str:
    text = (url or "").strip()
    if not text:
        raise ValueError("缺少页面 url")
    # 签名 url 不得含 hash
    return text.split("#", 1)[0]


async def _get_active_integration(tenant_id: int, type_name: str) -> Optional[IntegrationConfig]:
    return (
        await IntegrationConfig.filter(
            tenant_id=tenant_id,
            type=type_name,
            is_active=True,
            deleted_at__isnull=True,
        )
        .order_by("-updated_at")
        .first()
    )


async def _fetch_wecom_jsapi_ticket(access_token: str, *, agent: bool) -> tuple[str, int]:
    if agent:
        path = f"{WECOM_API_BASE}/ticket/get"
        params = {"access_token": access_token, "type": "agent_config"}
    else:
        path = f"{WECOM_API_BASE}/get_jsapi_ticket"
        params = {"access_token": access_token}
    resp = await get_http_client().get(path, params=params, timeout=10.0)
    data = resp.json()
    if data.get("errcode") not in (0, None):
        raise ValueError(data.get("errmsg") or "获取企业微信 jsapi_ticket 失败")
    ticket = data.get("ticket")
    if not isinstance(ticket, str) or not ticket.strip():
        raise ValueError("企业微信 jsapi_ticket 为空")
    return ticket.strip(), int(data.get("expires_in") or 7200)


async def _sign_wecom(tenant_id: int, url: str) -> MobileJsapiSignature:
    creds = await get_wecom_credentials(tenant_id)
    if not creds:
        raise ValueError("未配置启用的企业微信连接器")
    token = await fetch_wecom_access_token(creds.corp_id, creds.corp_secret)

    corp_key = f"wecom:corp:{tenant_id}:{creds.corp_id}"
    agent_key = f"wecom:agent:{tenant_id}:{creds.agent_id}"
    corp_ticket = _cache_get(corp_key)
    if not corp_ticket:
        corp_ticket, exp = await _fetch_wecom_jsapi_ticket(token, agent=False)
        _cache_set(corp_key, corp_ticket, exp)
    agent_ticket = _cache_get(agent_key)
    if not agent_ticket:
        agent_ticket, exp = await _fetch_wecom_jsapi_ticket(token, agent=True)
        _cache_set(agent_key, agent_ticket, exp)

    timestamp = int(time.time())
    nonce = secrets.token_hex(8)
    return MobileJsapiSignature(
        provider="wecom",
        corp_id=creds.corp_id,
        agent_id=creds.agent_id,
        app_id=None,
        timestamp=timestamp,
        nonce_str=nonce,
        signature=_sha1_sign(corp_ticket, nonce, timestamp, url),
        agent_signature=_sha1_sign(agent_ticket, nonce, timestamp, url),
    )


async def _sign_dingtalk(tenant_id: int, url: str) -> MobileJsapiSignature:
    integration = await _get_active_integration(tenant_id, "dingtalk")
    if not integration:
        raise ValueError("未配置启用的钉钉连接器")
    config: dict[str, Any] = integration.get_config()
    app_key = str(config.get("app_key") or "").strip()
    app_secret = str(config.get("app_secret") or "").strip()
    corp_id = str(config.get("corpid") or config.get("corp_id") or "").strip() or None
    agent_raw = config.get("agent_id")
    agent_id: Optional[int]
    try:
        agent_id = int(agent_raw) if agent_raw is not None and str(agent_raw).strip() != "" else None
    except (TypeError, ValueError):
        agent_id = None
    if not app_key or not app_secret:
        raise ValueError("钉钉连接器缺少 app_key / app_secret")

    token_key = f"dingtalk:token:{tenant_id}:{app_key}"
    access_token = _cache_get(token_key)
    if not access_token:
        resp = await get_http_client().get(
            "https://oapi.dingtalk.com/gettoken",
            params={"appkey": app_key, "appsecret": app_secret},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("errcode") not in (0, None):
            raise ValueError(data.get("errmsg") or "获取钉钉 access_token 失败")
        access_token = str(data.get("access_token") or "").strip()
        if not access_token:
            raise ValueError("钉钉 access_token 为空")
        _cache_set(token_key, access_token, int(data.get("expires_in") or 7200))

    ticket_key = f"dingtalk:jsapi:{tenant_id}:{app_key}"
    ticket = _cache_get(ticket_key)
    if not ticket:
        resp = await get_http_client().get(
            "https://oapi.dingtalk.com/get_jsapi_ticket",
            params={"access_token": access_token},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("errcode") not in (0, None):
            raise ValueError(data.get("errmsg") or "获取钉钉 jsapi_ticket 失败")
        ticket = str(data.get("ticket") or "").strip()
        if not ticket:
            raise ValueError("钉钉 jsapi_ticket 为空")
        _cache_set(ticket_key, ticket, int(data.get("expires_in") or 7200))

    timestamp = int(time.time())
    nonce = secrets.token_hex(8)
    return MobileJsapiSignature(
        provider="dingtalk",
        corp_id=corp_id,
        agent_id=agent_id,
        app_id=app_key,
        timestamp=timestamp,
        nonce_str=nonce,
        signature=_sha1_sign(ticket, nonce, timestamp, url),
    )


async def _sign_feishu(tenant_id: int, url: str) -> MobileJsapiSignature:
    integration = await _get_active_integration(tenant_id, "feishu")
    if not integration:
        raise ValueError("未配置启用的飞书连接器")
    config: dict[str, Any] = integration.get_config()
    app_id = str(config.get("app_id") or "").strip()
    app_secret = str(config.get("app_secret") or "").strip()
    if not app_id or not app_secret:
        raise ValueError("飞书连接器缺少 app_id / app_secret")

    token_key = f"feishu:token:{tenant_id}:{app_id}"
    app_access_token = _cache_get(token_key)
    if not app_access_token:
        resp = await get_http_client().post(
            "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
            json={"app_id": app_id, "app_secret": app_secret},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("code") not in (0, None):
            raise ValueError(data.get("msg") or "获取飞书 app_access_token 失败")
        app_access_token = str(data.get("app_access_token") or "").strip()
        if not app_access_token:
            raise ValueError("飞书 app_access_token 为空")
        _cache_set(token_key, app_access_token, int(data.get("expire") or 7200))

    ticket_key = f"feishu:jsapi:{tenant_id}:{app_id}"
    ticket = _cache_get(ticket_key)
    if not ticket:
        resp = await get_http_client().post(
            "https://open.feishu.cn/open-apis/jssdk/ticket/get",
            headers={"Authorization": f"Bearer {app_access_token}"},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("code") not in (0, None):
            raise ValueError(data.get("msg") or "获取飞书 jsapi_ticket 失败")
        ticket_data = data.get("data") or {}
        ticket = str(ticket_data.get("ticket") or "").strip()
        if not ticket:
            raise ValueError("飞书 jsapi_ticket 为空")
        _cache_set(ticket_key, ticket, int(ticket_data.get("expire_in") or 7200))

    timestamp = int(time.time())
    nonce = secrets.token_hex(8)
    return MobileJsapiSignature(
        provider="feishu",
        corp_id=None,
        agent_id=None,
        app_id=app_id,
        timestamp=timestamp,
        nonce_str=nonce,
        signature=_sha1_sign(ticket, nonce, timestamp, url),
    )


async def build_mobile_jsapi_signature(
    tenant_id: int,
    provider: JsapiProvider,
    url: str,
) -> MobileJsapiSignature:
    normalized = normalize_jsapi_url(url)
    if provider == "wecom":
        return await _sign_wecom(tenant_id, normalized)
    if provider == "dingtalk":
        return await _sign_dingtalk(tenant_id, normalized)
    if provider == "feishu":
        return await _sign_feishu(tenant_id, normalized)
    raise ValueError(f"不支持的 provider: {provider}")
