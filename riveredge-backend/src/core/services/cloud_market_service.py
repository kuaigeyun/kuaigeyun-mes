"""
云市场通用调用：阿里云 / 腾讯云市场 AppCode 简单认证。

调用地址、请求方式由连接器配置提供，禁止写死商品 URL。
"""

from __future__ import annotations

import re
from typing import Any, Dict
from urllib.parse import urlparse

import httpx
from loguru import logger

from core.config.cloud_market_spec import (
    CLOUD_MARKET_HTTP_METHOD_SET,
    CLOUD_MARKET_SCENE_SET,
)
from infra.exceptions.exceptions import ValidationError

_AUTH_FAIL_TOKENS = (
    "AppCode",
    "InvalidAppCode",
    "Unauthorized",
    "未购买",
    "套餐",
    "余量不足",
    "Quota",
)


def resolve_cloud_market_query_url(config: Dict[str, Any]) -> str:
    url = str(config.get("query_url") or "").strip()
    if not url:
        raise ValidationError("请填写接口文档中的调用地址")
    if not url.startswith("https://"):
        raise ValidationError("调用地址须为 https 开头的完整 URL")
    return url


def resolve_cloud_market_app_code(config: Dict[str, Any]) -> str:
    raw = str(config.get("app_code") or "")
    app_code = re.sub(r"[\s\u200b\u200c\u200d\ufeff]+", "", raw)
    if app_code.upper().startswith("APPCODE"):
        app_code = re.sub(r"^APPCODE[:：]?", "", app_code, flags=re.IGNORECASE)
    if not app_code or app_code == "****":
        raise ValidationError("请填写 AppCode")
    if app_code.isdigit():
        raise ValidationError("当前填写的是 AppKey。请从买家中心复制 AppCode")
    if len(app_code) < 16:
        raise ValidationError("AppCode 不完整，请从买家中心一键复制完整值")
    return app_code


def resolve_cloud_market_method(config: Dict[str, Any]) -> str:
    method = str(config.get("http_method") or "POST").strip().upper()
    if method not in CLOUD_MARKET_HTTP_METHOD_SET:
        raise ValidationError("请求方式须为 POST 或 GET")
    return method


def resolve_cloud_market_scene(config: Dict[str, Any]) -> str:
    scene = str(config.get("scene") or "").strip()
    if not scene:
        raise ValidationError("请选择调用场景")
    if scene not in CLOUD_MARKET_SCENE_SET:
        raise ValidationError("不支持的调用场景")
    return scene


def is_cloud_market_auth_failure(payload: Dict[str, Any]) -> bool:
    status = str(payload.get("status") or payload.get("code") or "").strip()
    if status in {"401", "403"}:
        return True
    message = str(payload.get("msg") or payload.get("errorMessage") or "")
    return any(token in message for token in _AUTH_FAIL_TOKENS)


def _gateway_error(resp: httpx.Response) -> str:
    header = str(resp.headers.get("X-Ca-Error-Message") or "").strip()
    try:
        body = resp.json()
    except Exception:
        body = None
    text = ""
    if isinstance(body, dict):
        text = str(
            body.get("errorMessage")
            or body.get("error_msg")
            or body.get("message")
            or body.get("msg")
            or ""
        ).strip()
    combined = f"{text} {header}"
    if "API not found" in combined:
        return "调用地址与已购服务不匹配，请按接口文档填写调用地址"
    if "Invalid AppCode" in combined or "InvalidAppCode" in combined:
        return "AppCode 无效或不属于该已购服务。请从买家中心复制完整 AppCode，不要填 AppKey"
    if text:
        return text
    if header:
        return header
    if resp.status_code == 401:
        return "AppCode 无效或已失效"
    if resp.status_code == 403:
        return "未授权或套餐余量不足"
    if resp.status_code == 404:
        return "调用地址与已购服务不匹配，请按接口文档填写调用地址"
    return "云市场请求失败，请检查调用地址与网络后重试"


async def call_cloud_market(
    *,
    query_url: str,
    app_code: str,
    method: str,
    fields: Dict[str, str],
) -> Dict[str, Any]:
    headers = {
        "Authorization": f"APPCODE {app_code}",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if method == "GET":
                resp = await client.get(query_url, params=fields, headers=headers)
            else:
                resp = await client.post(query_url, data=fields, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("云市场请求失败 url={} err={}", query_url, exc)
        raise ValidationError("云市场请求失败，请检查网络后重试") from exc
    if resp.status_code in (401, 403, 404):
        logger.warning(
            "云市场鉴权失败 host={} status={} app_code_len={}",
            urlparse(query_url).netloc,
            resp.status_code,
            len(app_code),
        )
        raise ValidationError(_gateway_error(resp))
    try:
        payload = resp.json()
    except Exception as exc:
        if resp.status_code >= 400:
            raise ValidationError(_gateway_error(resp)) from exc
        raise ValidationError("云市场返回格式无效") from exc
    if not isinstance(payload, dict):
        raise ValidationError("云市场返回格式无效")
    return payload
