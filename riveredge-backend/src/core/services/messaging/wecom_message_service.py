"""企业微信文本消息（应用连接器配置为唯一真源）。"""

from __future__ import annotations

from loguru import logger

from core.services.integration.wecom_integration import (
    fetch_wecom_access_token,
    get_wecom_credentials,
)
from core.services.integration.wecom_oauth_service import extract_wecom_user_id
from infra.infrastructure.http.client import get_http_client
from infra.models.user import User


def _parse_recipient_tokens(recipient: str) -> list[str]:
    return [v.strip() for v in str(recipient or "").replace(",", "|").split("|") if v.strip()]


def _is_platform_user_id_token(token: str) -> bool:
    return token.isdigit() and int(token) > 0


async def resolve_wecom_recipient_userids(
    *,
    tenant_id: int,
    recipient: str,
) -> tuple[list[str], str | None]:
    """
    将推送 recipient 解析为企业微信 userid。
    纯数字 token 视为平台 user_id；其余 token 原样当作企微 userid（测试或手工填写）。
    """
    tokens = _parse_recipient_tokens(recipient)
    if not tokens:
        return [], "缺少推送接收人"

    resolved: list[str] = []
    errors: list[str] = []
    for token in tokens:
        if _is_platform_user_id_token(token):
            user = await User.filter(tenant_id=tenant_id, id=int(token)).first()
            if not user:
                errors.append(f"用户 {token} 不存在")
                continue
            wecom_uid = extract_wecom_user_id(user)
            if not wecom_uid:
                errors.append(f"用户 {token} 未绑定企业微信")
                continue
            resolved.append(wecom_uid)
        else:
            resolved.append(token)

    if errors:
        return [], "; ".join(errors)
    return resolved, None


async def send_wecom_text_message(
    *,
    tenant_id: int,
    user_ids: list[str],
    content: str,
) -> bool:
    """向企业微信用户发送文本消息；未配置连接器或无 userid 时返回 False。"""
    touser = "|".join([uid.strip() for uid in user_ids if uid and str(uid).strip()])
    if not touser or not content.strip():
        return False

    creds = await get_wecom_credentials(tenant_id)
    if not creds:
        logger.info("租户 {} 未配置启用的企业微信连接器，跳过 WeCom 通知", tenant_id)
        return False

    token = await fetch_wecom_access_token(creds.corp_id, creds.corp_secret)
    payload = {
        "touser": touser,
        "msgtype": "text",
        "agentid": creds.agent_id,
        "text": {"content": content[:2048]},
        "safe": 0,
    }
    resp = await get_http_client().post(
        "https://qyapi.weixin.qq.com/cgi-bin/message/send",
        params={"access_token": token},
        json=payload,
        timeout=10.0,
    )
    data = resp.json()
    if data.get("errcode") != 0:
        raise ValueError(data.get("errmsg") or "企业微信消息发送失败")
    return True


async def send_wecom_textcard_message(
    *,
    tenant_id: int,
    user_ids: list[str],
    title: str,
    description: str,
    url: str,
) -> bool:
    """向企业微信用户发送 textcard；url 须为完整 https 链接。"""
    touser = "|".join([uid.strip() for uid in user_ids if uid and str(uid).strip()])
    link = str(url or "").strip()
    if not touser or not link:
        return False

    creds = await get_wecom_credentials(tenant_id)
    if not creds:
        logger.info("租户 {} 未配置启用的企业微信连接器，跳过 WeCom 卡片", tenant_id)
        return False

    token = await fetch_wecom_access_token(creds.corp_id, creds.corp_secret)
    payload = {
        "touser": touser,
        "msgtype": "textcard",
        "agentid": creds.agent_id,
        "textcard": {
            "title": (title or "新消息")[:128],
            "description": (description or "")[:512],
            "url": link[:2048],
            "btntxt": "查看详情",
        },
    }
    resp = await get_http_client().post(
        "https://qyapi.weixin.qq.com/cgi-bin/message/send",
        params={"access_token": token},
        json=payload,
        timeout=10.0,
    )
    data = resp.json()
    if data.get("errcode") != 0:
        raise ValueError(data.get("errmsg") or "企业微信卡片消息发送失败")
    return True
