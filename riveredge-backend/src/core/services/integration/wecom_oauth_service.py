"""企业微信 OAuth 登录（应用连接器为唯一真源）。"""

from __future__ import annotations

import base64
import json
import re
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


def _normalize_phone(value: str | None) -> str | None:
    if not value or not isinstance(value, str):
        return None
    digits = re.sub(r"\D", "", value.strip())
    if len(digits) < 7:
        return None
    return digits


def _normalize_email(value: str | None) -> str | None:
    if not value or not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized or None


async def fetch_wecom_member_contact(*, tenant_id: int, wecom_userid: str) -> dict[str, str | None]:
    """读取企微通讯录成员手机号/邮箱，用于首次扫码自动绑定。"""
    token = await fetch_wecom_access_token_for_tenant(tenant_id)
    resp = await get_http_client().get(
        "https://qyapi.weixin.qq.com/cgi-bin/user/get",
        params={"access_token": token, "userid": wecom_userid},
        timeout=10.0,
    )
    data = resp.json()
    if data.get("errcode") != 0:
        logger.warning("企微通讯录读取成员失败 tenant={} userid={}: {}", tenant_id, wecom_userid, data)
        return {"mobile": None, "email": None}
    mobile = _normalize_phone(data.get("mobile") if isinstance(data.get("mobile"), str) else None)
    email = _normalize_email(
        data.get("email") if isinstance(data.get("email"), str) else None
    ) or _normalize_email(data.get("biz_mail") if isinstance(data.get("biz_mail"), str) else None)
    return {"mobile": mobile, "email": email}


async def _list_active_tenant_users(tenant_id: int) -> list[User]:
    return await User.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    )


def _dedupe_users(users: list[User]) -> list[User]:
    seen: set[int] = set()
    result: list[User] = []
    for user in users:
        if user.id in seen:
            continue
        seen.add(user.id)
        result.append(user)
    return result


async def find_users_by_phone(*, tenant_id: int, phone: str | None) -> list[User]:
    normalized = _normalize_phone(phone)
    if not normalized:
        return []
    matched: list[User] = []
    for user in await _list_active_tenant_users(tenant_id):
        if _normalize_phone(user.phone) == normalized:
            matched.append(user)
    return matched


async def find_users_by_email(*, tenant_id: int, email: str | None) -> list[User]:
    normalized = _normalize_email(email)
    if not normalized:
        return []
    matched: list[User] = []
    for user in await _list_active_tenant_users(tenant_id):
        if _normalize_email(user.email) == normalized:
            matched.append(user)
    return matched


async def find_users_by_username(*, tenant_id: int, username: str | None) -> list[User]:
    if not username or not isinstance(username, str) or not username.strip():
        return []
    target = username.strip().lower()
    matched: list[User] = []
    for user in await _list_active_tenant_users(tenant_id):
        if user.username.strip().lower() == target:
            matched.append(user)
    return matched


async def bind_wecom_userid_to_user(*, user: User, wecom_userid: str) -> User:
    bound = wecom_userid.strip()
    if not bound:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="企业微信 UserID 无效")
    existing = _extract_wecom_user_id(user)
    if existing and existing.lower() != bound.lower():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该账号已绑定其他企业微信用户",
        )
    contact = user.contact_info if isinstance(user.contact_info, dict) else {}
    user.contact_info = {**contact, "wecom_userid": bound}
    await user.save(update_fields=["contact_info", "updated_at"])
    return user


async def resolve_user_for_wecom_login(*, tenant_id: int, wecom_userid: str) -> User:
    """
    企微扫码登录用户解析：已绑定则直接返回；否则按通讯录手机号/邮箱/账号自动绑定。
    """
    bound_user = await find_user_by_wecom_userid(tenant_id=tenant_id, wecom_userid=wecom_userid)
    if bound_user:
        return bound_user

    contact = await fetch_wecom_member_contact(tenant_id=tenant_id, wecom_userid=wecom_userid)
    candidates = _dedupe_users(
        [
            *(await find_users_by_phone(tenant_id=tenant_id, phone=contact.get("mobile"))),
            *(await find_users_by_email(tenant_id=tenant_id, email=contact.get("email"))),
            *(await find_users_by_username(tenant_id=tenant_id, username=wecom_userid)),
        ]
    )

    if len(candidates) == 1:
        user = candidates[0]
        existing = _extract_wecom_user_id(user)
        if existing and existing.lower() != wecom_userid.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="匹配到的系统账号已绑定其他企业微信用户",
            )
        return await bind_wecom_userid_to_user(user=user, wecom_userid=wecom_userid)

    if len(candidates) > 1:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="匹配到多个系统账号，请联系管理员处理后再使用企业微信登录",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "未能自动绑定企业微信账号，请确认系统用户手机号或邮箱与企微通讯录一致，"
            "或在个人资料中扫码绑定"
        ),
    )


async def bind_wecom_user_for_current_user(
    *,
    tenant_id: int,
    user: User,
    wecom_userid: str,
) -> User:
    """已登录用户在个人资料中扫码绑定企微。"""
    if user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="组织上下文不匹配")
    existing = await find_user_by_wecom_userid(tenant_id=tenant_id, wecom_userid=wecom_userid)
    if existing and existing.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该企业微信账号已绑定其他用户",
        )
    return await bind_wecom_userid_to_user(user=user, wecom_userid=wecom_userid)
