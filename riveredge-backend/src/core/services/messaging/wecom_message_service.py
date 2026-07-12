"""企业微信文本消息（应用连接器配置为唯一真源）。"""

from __future__ import annotations

from loguru import logger

from core.services.integration.wecom_integration import (
    fetch_wecom_access_token,
    get_wecom_credentials,
)
from infra.infrastructure.http.client import get_http_client


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
