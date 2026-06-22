"""极光推送（简易版）：按 alias 向移动端下发锁屏/通知栏消息。"""

from __future__ import annotations

import asyncio
import base64
from typing import Any

import httpx
from loguru import logger

from core.config.client_product_registry import CLIENT_KEY_HAOLIGO
from core.services.messaging.push_payload import build_push_extras, plain_text
from infra.config.infra_config import infra_settings

_JPUSH_PUSH_URL = "https://api.jpush.cn/v3/push"


def build_jpush_alias(*, tenant_id: int, user_id: int) -> str:
    return f"{tenant_id}_{user_id}"


def _auth_header_from_credentials(app_key: str, master_secret: str) -> str:
    token = base64.b64encode(f"{app_key}:{master_secret}".encode()).decode()
    return f"Basic {token}"


def push_enabled() -> bool:
    if not infra_settings.PUSH_ENABLED:
        return False
    app_key = (infra_settings.JPUSH_APP_KEY or "").strip()
    master_secret = (infra_settings.JPUSH_MASTER_SECRET or "").strip()
    return bool(app_key and master_secret)


async def push_enabled_for_client(client_key: str = CLIENT_KEY_HAOLIGO) -> bool:
    from core.services.client_product_config_service import resolve_jpush_credentials

    if not infra_settings.PUSH_ENABLED:
        return False
    return (await resolve_jpush_credentials(client_key)) is not None


def _interpret_jpush_test_result(*, http_status: int, body: str, alias: str) -> str | None:
    text = (body or "").strip()
    if http_status == 200:
        return "极光已受理推送；若手机仍无通知，请检查通知权限并保持 App 登录约 10 秒。"
    if "1011" in text:
        return (
            f"极光找不到 alias={alias} 对应设备（手机尚未绑定）。"
            "请安装含 JPush 的正式 APK、登录、允许通知，并保持 App 前台约 10 秒后重试。"
        )
    if http_status == 401:
        return "AppKey 或 Master Secret 无效，请核对平台客户端配置与极光控制台。"
    return "极光 API 返回异常，请查看 jpush_message 详情。"


async def send_jpush_test_notification(
    *,
    tenant_id: int,
    user_id: int,
    client_key: str = CLIENT_KEY_HAOLIGO,
    title: str = "推送测试",
    body: str = "这是一条来自 RiverEdge 的测试推送",
    registration_id: str | None = None,
) -> dict[str, Any]:
    """向指定用户 alias 或 RegistrationID 发送测试通知，返回极光原始响应便于排查。"""
    from core.services.client_product_config_service import resolve_jpush_credentials

    if not infra_settings.PUSH_ENABLED:
        return {
            "alias": build_jpush_alias(tenant_id=tenant_id, user_id=user_id),
            "success": False,
            "http_status": 0,
            "jpush_message": "PUSH_ENABLED=false",
            "hint": "请在服务端 .env 设置 PUSH_ENABLED=true",
        }

    creds = await resolve_jpush_credentials(client_key)
    alias = build_jpush_alias(tenant_id=tenant_id, user_id=user_id)
    if not creds:
        return {
            "alias": alias,
            "success": False,
            "http_status": 0,
            "jpush_message": "missing credentials",
            "hint": "推送凭据未就绪：请配置 AppKey 与 Master Secret，并确认 push_enabled=true",
        }

    app_key, master_secret = creds
    auth = _auth_header_from_credentials(app_key, master_secret)
    rid = (registration_id or "").strip()
    audience: dict[str, Any]
    target_label: str
    if rid:
        audience = {"registration_id": [rid]}
        target_label = f"registration_id={rid}"
    else:
        audience = {"alias": [alias]}
        target_label = f"alias={alias}"
    payload: dict[str, Any] = {
        "platform": "android",
        "audience": audience,
        "notification": {
            "alert": body,
            "android": {
                "alert": body,
                "title": title,
                "extras": {
                    "tenant_id": str(tenant_id),
                    "route_kind": "message",
                },
            },
        },
        "options": {"apns_production": False},
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                _JPUSH_PUSH_URL,
                json=payload,
                headers={"Authorization": auth, "Content-Type": "application/json"},
            )
        body_text = response.text[:1000]
        success = response.status_code == 200
        hint = _interpret_jpush_test_result(http_status=response.status_code, body=body_text, alias=alias)
        if rid and success:
            hint = (
                f"极光已受理对 {target_label} 的推送；若手机仍无通知，"
                "请保持 App 在前台并确认已允许通知权限。"
            )
        if success:
            logger.info("极光测试推送成功 {}", target_label)
        else:
            logger.warning(
                "极光测试推送失败 {} status={} body={}",
                target_label,
                response.status_code,
                body_text[:500],
            )
        return {
            "alias": alias,
            "success": success,
            "http_status": response.status_code,
            "jpush_message": body_text,
            "hint": hint,
            "target": target_label,
        }
    except Exception as exc:
        logger.warning("极光测试推送异常 alias={}: {}", alias, exc)
        return {
            "alias": alias,
            "success": False,
            "http_status": 0,
            "jpush_message": str(exc),
            "hint": "请求极光 API 失败，请检查服务器出网与 DNS",
        }


async def push_internal_message_to_user(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    message_log_uuid: str,
    variables: dict[str, Any] | None = None,
) -> None:
    """按 alias 推送站内信通知；失败只记日志，不抛异常。"""
    from core.services.client_product_config_service import resolve_jpush_credentials

    creds = await resolve_jpush_credentials(CLIENT_KEY_HAOLIGO)
    if not creds:
        logger.warning("极光推送跳过：未配置凭据或 push_enabled=false（client={}）", CLIENT_KEY_HAOLIGO)
        return
    app_key, master_secret = creds
    auth = _auth_header_from_credentials(app_key, master_secret)

    alias = build_jpush_alias(tenant_id=tenant_id, user_id=user_id)
    title = (subject or "新消息").strip() or "新消息"
    body = plain_text(content) or title
    extras = build_push_extras(
        tenant_id=tenant_id,
        message_log_uuid=message_log_uuid,
        subject=title,
        variables=variables,
    )

    payload: dict[str, Any] = {
        "platform": "android",
        "audience": {"alias": [alias]},
        "notification": {
            "alert": body,
            "android": {
                "alert": body,
                "title": title,
                "extras": extras,
            },
        },
        "options": {
            "apns_production": False,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                _JPUSH_PUSH_URL,
                json=payload,
                headers={
                    "Authorization": auth,
                    "Content-Type": "application/json",
                },
            )
        if response.status_code != 200:
            logger.warning(
                "极光推送失败 alias={} status={} body={}",
                alias,
                response.status_code,
                response.text[:500],
            )
            return
        logger.info("极光推送成功 alias={} msg={}", alias, message_log_uuid)
    except Exception as exc:
        logger.warning("极光推送异常 alias={}: {}", alias, exc)


def _active_push_provider() -> str:
    return (infra_settings.PUSH_PROVIDER or "fcm").strip().lower()


def schedule_internal_message_push(
    *,
    tenant_id: int,
    user_id: int,
    subject: str,
    content: str,
    message_log_uuid: str,
    variables: dict[str, Any] | None = None,
) -> None:
    """站内信落库后异步推送，不阻塞主流程。"""
    if not infra_settings.PUSH_ENABLED:
        return

    async def _run() -> None:
        provider = _active_push_provider()
        if provider == "fcm":
            from core.services.messaging.fcm_dispatch_service import (
                fcm_push_enabled,
                push_internal_message_to_user_fcm,
            )

            if not fcm_push_enabled():
                return
            await push_internal_message_to_user_fcm(
                tenant_id=tenant_id,
                user_id=user_id,
                subject=subject,
                content=content,
                message_log_uuid=message_log_uuid,
                variables=variables,
            )
            return

        from core.services.client_product_config_service import push_enabled_for_client

        if not await push_enabled_for_client(CLIENT_KEY_HAOLIGO):
            return
        await push_internal_message_to_user(
            tenant_id=tenant_id,
            user_id=user_id,
            subject=subject,
            content=content,
            message_log_uuid=message_log_uuid,
            variables=variables,
        )

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run())
    except RuntimeError:
        asyncio.run(_run())


async def send_push_test_notification(
    *,
    tenant_id: int,
    user_id: int,
    client_key: str = CLIENT_KEY_HAOLIGO,
    registration_id: str | None = None,
    fcm_token: str | None = None,
) -> dict[str, Any]:
    """按当前 PUSH_PROVIDER 发送测试推送（FCM 或极光）。"""
    provider = _active_push_provider()
    if provider == "fcm":
        from core.services.messaging.fcm_dispatch_service import send_fcm_test_notification

        result = await send_fcm_test_notification(
            tenant_id=tenant_id,
            user_id=user_id,
            fcm_token=fcm_token or registration_id,
        )
        return {
            **result,
            "jpush_message": result.get("provider_message", ""),
        }

    result = await send_jpush_test_notification(
        tenant_id=tenant_id,
        user_id=user_id,
        client_key=client_key,
        registration_id=registration_id,
    )
    return {
        **result,
        "provider_message": result.get("jpush_message", ""),
    }
