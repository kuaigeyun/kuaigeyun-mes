"""企业微信连接器公共能力（OAuth / 消息发送唯一真源：IntegrationConfig type=wecom）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from core.models.integration_config import IntegrationConfig
from infra.infrastructure.http.client import get_http_client


@dataclass(frozen=True)
class WeComCredentials:
    corp_id: str
    corp_secret: str
    agent_id: int


async def get_active_wecom_integration(tenant_id: int) -> Optional[IntegrationConfig]:
    return (
        await IntegrationConfig.filter(
            tenant_id=tenant_id,
            type="wecom",
            is_active=True,
            deleted_at__isnull=True,
        )
        .order_by("-updated_at")
        .first()
    )


async def get_wecom_credentials(tenant_id: int) -> Optional[WeComCredentials]:
    integration = await get_active_wecom_integration(tenant_id)
    if not integration:
        return None
    config: dict[str, Any] = integration.get_config()
    corp_id = str(config.get("corp_id") or "").strip()
    corp_secret = str(config.get("corp_secret") or "").strip()
    agent_id = config.get("agent_id")
    if not corp_id or not corp_secret or agent_id is None:
        return None
    try:
        agent_id_int = int(agent_id)
    except (TypeError, ValueError):
        return None
    return WeComCredentials(corp_id=corp_id, corp_secret=corp_secret, agent_id=agent_id_int)


async def fetch_wecom_access_token(corp_id: str, corp_secret: str) -> str:
    resp = await get_http_client().get(
        "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
        params={"corpid": corp_id, "corpsecret": corp_secret},
        timeout=10.0,
    )
    data = resp.json()
    if data.get("errcode") != 0:
        raise ValueError(data.get("errmsg") or "获取企业微信 access_token 失败")
    token = data.get("access_token")
    if not isinstance(token, str) or not token.strip():
        raise ValueError("企业微信 access_token 为空")
    return token


async def fetch_wecom_access_token_for_tenant(tenant_id: int) -> str:
    creds = await get_wecom_credentials(tenant_id)
    if not creds:
        raise ValueError("未配置启用的企业微信连接器")
    return await fetch_wecom_access_token(creds.corp_id, creds.corp_secret)
