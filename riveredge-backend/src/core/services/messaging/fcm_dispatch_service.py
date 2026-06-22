"""Firebase Cloud Messaging（HTTP v1）推送。"""

from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from jose import jwt
from loguru import logger

from core.services.messaging.mobile_push_device_service import (
    deactivate_fcm_token,
    list_active_fcm_tokens,
)
from core.services.messaging.push_payload import build_push_extras, plain_text
from infra.config.infra_config import infra_settings

_FCM_SEND_URL = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
_FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_INVALID_TOKEN_MARKERS = (
    "UNREGISTERED",
    "INVALID_ARGUMENT",
    "NOT_FOUND",
    "registration-token-not-registered",
)


@lru_cache(maxsize=1)
def _load_service_account_info() -> dict[str, Any] | None:
    raw = (infra_settings.FCM_SERVICE_ACCOUNT_JSON or "").strip()
    if not raw:
        return None
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("FCM_SERVICE_ACCOUNT_JSON 不是合法 JSON")
            return None
    path = Path(raw)
    if not path.is_file():
        logger.warning("FCM 服务账号文件不存在: {}", raw)
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("读取 FCM 服务账号失败: {}", exc)
        return None


def _resolve_project_id(info: dict[str, Any]) -> str:
    configured = (infra_settings.FCM_PROJECT_ID or "").strip()
    if configured:
        return configured
    return str(info.get("project_id") or "").strip()


def fcm_push_enabled() -> bool:
    if not infra_settings.PUSH_ENABLED:
        return False
    provider = (infra_settings.PUSH_PROVIDER or "fcm").strip().lower()
    if provider != "fcm":
        return False
    info = _load_service_account_info()
    if not info:
        return False
    return bool(_resolve_project_id(info))


def _fetch_access_token(info: dict[str, Any]) -> str | None:
    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": info["client_email"],
            "sub": info["client_email"],
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
            "scope": _FCM_SCOPE,
        },
        info["private_key"],
        algorithm="RS256",
    )
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                },
            )
        if response.status_code != 200:
            logger.warning("FCM OAuth token 失败 status={} body={}", response.status_code, response.text[:500])
            return None
        payload = response.json()
        token = str(payload.get("access_token") or "").strip()
        return token or None
    except Exception as exc:
        logger.warning("FCM OAuth token 异常: {}", exc)
        return None


def _get_access_token() -> tuple[str, str] | None:
    info = _load_service_account_info()
    if not info:
        return None
    project_id = _resolve_project_id(info)
    if not project_id:
        logger.warning("FCM project_id 未配置且服务账号 JSON 中缺失")
        return None
    token = _fetch_access_token(info)
    if not token:
        return None
    return project_id, token


def _token_invalid_response(*, http_status: int, body_text: str) -> bool:
    if http_status == 404:
        return True
    upper = body_text.upper()
    return any(marker in upper for marker in _INVALID_TOKEN_MARKERS)


async def _send_fcm_to_token(
    *,
    project_id: str,
    access_token: str,
    token: str,
    title: str,
    body: str,
    data: dict[str, str],
) -> tuple[bool, int, str]:
    payload = {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "data": data,
            "android": {
                "priority": "HIGH",
                "notification": {
                    "channel_id": "haoligo-default",
                    "notification_priority": "PRIORITY_HIGH",
                },
            },
        }
    }
    url = _FCM_SEND_URL.format(project_id=project_id)
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        )
    body_text = response.text[:1000]
    return response.status_code == 200, response.status_code, body_text


async def push_internal_message_to_user_fcm(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    message_log_uuid: str,
    variables: dict[str, Any] | None = None,
) -> None:
    """向用户已注册 FCM token 推送站内信；失败只记日志。"""
    if not fcm_push_enabled():
        logger.warning("FCM 推送跳过：未启用或未配置服务账号")
        return

    auth = _get_access_token()
    if not auth:
        logger.warning("FCM 推送跳过：无法获取 access token")
        return
    project_id, access_token = auth

    tokens = await list_active_fcm_tokens(tenant_id=tenant_id, user_id=user_id)
    if not tokens:
        logger.info("FCM 推送跳过：用户无有效 token tenant={} user={}", tenant_id, user_id)
        return

    title = (subject or "新消息").strip() or "新消息"
    body = plain_text(content) or title
    data = build_push_extras(
        tenant_id=tenant_id,
        message_log_uuid=message_log_uuid,
        subject=title,
        variables=variables,
    )

    sent = 0
    for token in tokens:
        try:
            ok, status, resp_body = await _send_fcm_to_token(
                project_id=project_id,
                access_token=access_token,
                token=token,
                title=title,
                body=body,
                data=data,
            )
            if ok:
                sent += 1
                continue
            logger.warning(
                "FCM 推送失败 tenant={} user={} status={} body={}",
                tenant_id,
                user_id,
                status,
                resp_body[:500],
            )
            if _token_invalid_response(http_status=status, body_text=resp_body):
                await deactivate_fcm_token(tenant_id=tenant_id, token=token)
        except Exception as exc:
            logger.warning("FCM 推送异常 tenant={} user={}: {}", tenant_id, user_id, exc)

    if sent:
        logger.info("FCM 推送成功 tenant={} user={} msg={} devices={}", tenant_id, user_id, message_log_uuid, sent)


def _interpret_fcm_test_result(*, http_status: int, body: str, token_count: int) -> str | None:
    if http_status == 200:
        return (
            f"FCM 已受理推送（{token_count} 个设备）；"
            "若手机仍无通知，请检查通知权限并保持 App 登录约 10 秒。"
        )
    if http_status == 404 or "UNREGISTERED" in body.upper():
        return "FCM token 无效或已注销，请在手机上重新登录并允许通知。"
    if http_status == 401 or http_status == 403:
        return "FCM 服务账号无效或无 Firebase Messaging 权限，请检查 FCM_SERVICE_ACCOUNT_JSON。"
    return "FCM API 返回异常，请查看 provider_message 详情。"


async def send_fcm_test_notification(
    *,
    tenant_id: int,
    user_id: int,
    title: str = "推送测试",
    body: str = "这是一条来自 RiverEdge 的 FCM 测试推送",
    fcm_token: str | None = None,
) -> dict[str, Any]:
    """向指定用户或单个 FCM token 发送测试通知。"""
    alias = f"{tenant_id}_{user_id}"
    if not infra_settings.PUSH_ENABLED:
        return {
            "alias": alias,
            "success": False,
            "http_status": 0,
            "provider_message": "PUSH_ENABLED=false",
            "hint": "请在服务端 .env 设置 PUSH_ENABLED=true",
            "target": alias,
        }
    if not fcm_push_enabled():
        return {
            "alias": alias,
            "success": False,
            "http_status": 0,
            "provider_message": "FCM not configured",
            "hint": "请配置 PUSH_PROVIDER=fcm 与 FCM_SERVICE_ACCOUNT_JSON",
            "target": alias,
        }

    auth = _get_access_token()
    if not auth:
        return {
            "alias": alias,
            "success": False,
            "http_status": 0,
            "provider_message": "missing access token",
            "hint": "无法从服务账号获取 FCM access token",
            "target": alias,
        }
    project_id, access_token = auth

    explicit = (fcm_token or "").strip()
    if explicit:
        tokens = [explicit]
        target_label = f"fcm_token={explicit[:12]}…"
    else:
        tokens = await list_active_fcm_tokens(tenant_id=tenant_id, user_id=user_id)
        target_label = f"user={alias} tokens={len(tokens)}"

    if not tokens:
        return {
            "alias": alias,
            "success": False,
            "http_status": 0,
            "provider_message": "no active fcm tokens",
            "hint": "手机尚未注册 FCM token。请安装含 FCM 的 APK、登录并允许通知。",
            "target": target_label,
        }

    data = build_push_extras(
        tenant_id=tenant_id,
        message_log_uuid="test",
        subject=title,
        variables={"route_kind": "message"},
    )
    last_status = 0
    last_body = ""
    success = False
    for token in tokens:
        ok, status, resp_body = await _send_fcm_to_token(
            project_id=project_id,
            access_token=access_token,
            token=token,
            title=title,
            body=body,
            data=data,
        )
        last_status = status
        last_body = resp_body
        if ok:
            success = True
        elif _token_invalid_response(http_status=status, body_text=resp_body):
            await deactivate_fcm_token(tenant_id=tenant_id, token=token)

    hint = _interpret_fcm_test_result(http_status=last_status, body=last_body, token_count=len(tokens))
    return {
        "alias": alias,
        "success": success,
        "http_status": last_status,
        "provider_message": last_body,
        "hint": hint,
        "target": target_label,
    }
