"""企业微信 OAuth 登录（应用连接器为唯一真源）。"""

from __future__ import annotations

import base64
import json
import secrets
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException, status
from loguru import logger

from core.services.integration.wecom_integration import (
    fetch_wecom_access_token_for_tenant,
    get_wecom_credentials,
)
from infra.infrastructure.http.client import get_http_client
from infra.models.user import User


def _extract_wecom_user_id(user: User) -> str | None:
    contact = user.contact_info if isinstance(user.contact_info, dict) else {}
    for key in ("wecom_userid", "wecom_user_id", "wx_work_userid"):
        value = contact.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def encode_wecom_oauth_state(*, tenant_id: int, redirect: str | None = None) -> str:
    payload = {
        "t": tenant_id,
        "r": (redirect or "").strip(),
        "n": secrets.token_urlsafe(8),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_wecom_oauth_state(state: str) -> dict[str, Any]:
    if not state or not isinstance(state, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state 无效")
    padded = state + "=" * (-len(state) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state 无效") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state 无效")
    tenant_id = payload.get("t")
    try:
        tenant_id_int = int(tenant_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state 缺少组织") from exc
    redirect = payload.get("r")
    return {
        "tenant_id": tenant_id_int,
        "redirect": redirect.strip() if isinstance(redirect, str) else "",
        "nonce": payload.get("n"),
    }


async def build_wecom_oauth_authorize_url(
    *,
    tenant_id: int,
    redirect_uri: str,
    state: str,
    scope: str = "snsapi_base",
) -> str:
    creds = await get_wecom_credentials(tenant_id)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置启用的企业微信连接器，无法发起 OAuth",
        )
    encoded_redirect = quote(redirect_uri, safe="")
    return (
        "https://open.weixin.qq.com/connect/oauth2/authorize"
        f"?appid={quote(creds.corp_id, safe='')}"
        f"&redirect_uri={encoded_redirect}"
        "&response_type=code"
        f"&scope={quote(scope, safe='')}"
        f"&agentid={creds.agent_id}"
        f"&state={quote(state, safe='')}"
        "#wechat_redirect"
    )


async def resolve_wecom_user_id_from_code(*, tenant_id: int, code: str) -> str:
    if not code or not str(code).strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少 OAuth code")
    token = await fetch_wecom_access_token_for_tenant(tenant_id)
    resp = await get_http_client().get(
        "https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo",
        params={"access_token": token, "code": str(code).strip()},
        timeout=10.0,
    )
    data = resp.json()
    if data.get("errcode") != 0:
        logger.warning("企微 OAuth getuserinfo 失败 tenant={}: {}", tenant_id, data)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=data.get("errmsg") or "企业微信身份验证失败",
        )
    userid = data.get("userid") or data.get("UserId")
    if not isinstance(userid, str) or not userid.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未能获取企业微信用户标识，请确认应用可见范围",
        )
    return userid.strip()


async def find_user_by_wecom_userid(*, tenant_id: int, wecom_userid: str) -> User | None:
    users = await User.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    )
    target = wecom_userid.strip().lower()
    for user in users:
        bound = _extract_wecom_user_id(user)
        if bound and bound.lower() == target:
            return user
    return None
