"""企业微信连接器公共能力（OAuth / 消息 / 通讯录唯一真源：IntegrationConfig type=wecom）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from core.models.integration_config import IntegrationConfig
from infra.infrastructure.http.client import get_http_client

WECOM_API_BASE = "https://qyapi.weixin.qq.com/cgi-bin"


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
        f"{WECOM_API_BASE}/gettoken",
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


async def list_wecom_departments(access_token: str) -> list[dict[str, Any]]:
    """拉取企业微信全部部门（需应用具备通讯录只读权限）。"""
    resp = await get_http_client().get(
        f"{WECOM_API_BASE}/department/list",
        params={"access_token": access_token},
        timeout=30.0,
    )
    data = resp.json()
    if data.get("errcode") != 0:
        raise ValueError(data.get("errmsg") or "获取企业微信部门列表失败")
    departments = data.get("department")
    if not isinstance(departments, list):
        return []
    return [d for d in departments if isinstance(d, dict)]


async def list_wecom_users(
    access_token: str,
    *,
    department_id: int,
    fetch_child: bool = True,
) -> list[dict[str, Any]]:
    """拉取指定部门下成员详情（fetch_child=True 含子部门）。"""
    resp = await get_http_client().get(
        f"{WECOM_API_BASE}/user/list",
        params={
            "access_token": access_token,
            "department_id": department_id,
            "fetch_child": 1 if fetch_child else 0,
        },
        timeout=60.0,
    )
    data = resp.json()
    if data.get("errcode") != 0:
        raise ValueError(data.get("errmsg") or "获取企业微信成员列表失败")
    userlist = data.get("userlist")
    if not isinstance(userlist, list):
        return []
    return [u for u in userlist if isinstance(u, dict)]
