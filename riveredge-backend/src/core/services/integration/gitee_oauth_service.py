"""Gitee OAuth 登录（平台设置 Client ID/Secret 为唯一真源）。"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any
from urllib.parse import urlencode

from fastapi import HTTPException, status
from loguru import logger

from infra.constants.official_provenance import OFFICIAL_GITEE_REPO_SLUG
from infra.infrastructure.http.client import get_http_client
from infra.models.platform_settings import PlatformSettings
from infra.models.user import User

GITEE_AUTHORIZE_URL = "https://gitee.com/oauth/authorize"
GITEE_TOKEN_URL = "https://gitee.com/oauth/token"
GITEE_USER_API = "https://gitee.com/api/v5/user"
GITEE_EMAILS_API = "https://gitee.com/api/v5/emails"
GITEE_STARRED_API = "https://gitee.com/api/v5/user/starred/{owner}/{repo}"
GITEE_STARRED_LIST_API = "https://gitee.com/api/v5/user/starred"
# Gitee 官方 OAuth scope：白名单无 emails；写 emails 会直接 400「请求范围无效」。
# 登录只需 user_info。勿再带 projects——部分生产应用会拒收并报「请求范围无效」；
# Star 已改为官网引导，不再依赖 Star API 授权。
GITEE_OAUTH_SCOPE = "user_info"

_GITEE_ID_KEYS = ("gitee_id", "gitee_user_id")
_GITEE_NOREPLY_SUFFIX = "@user.noreply.gitee.com"
_GITEE_EMAIL_PLACEHOLDERS = frozenset({"未公开邮箱", "未设置", "private", "null", "none"})


class GiteeOAuthCredentials:
    __slots__ = ("client_id", "client_secret")

    def __init__(self, client_id: str, client_secret: str) -> None:
        self.client_id = client_id
        self.client_secret = client_secret


async def get_gitee_oauth_credentials() -> GiteeOAuthCredentials | None:
    settings = await PlatformSettings.first()
    if not settings:
        return None
    client_id = (settings.gitee_oauth_client_id or "").strip()
    client_secret = (settings.gitee_oauth_client_secret or "").strip()
    if not client_id or not client_secret:
        return None
    return GiteeOAuthCredentials(client_id=client_id, client_secret=client_secret)


def encode_gitee_oauth_state(
    *,
    tenant_id: int,
    redirect_uri: str,
    redirect: str | None = None,
) -> str:
    payload = {
        "t": tenant_id,
        "u": redirect_uri.strip(),
        "r": (redirect or "").strip(),
        "n": secrets.token_urlsafe(8),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_gitee_oauth_state(state: str) -> dict[str, Any]:
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
    try:
        tenant_id_int = int(payload.get("t"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state 缺少组织") from exc
    redirect_uri = payload.get("u")
    if not isinstance(redirect_uri, str) or not redirect_uri.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state 缺少回调地址")
    redirect = payload.get("r")
    return {
        "tenant_id": tenant_id_int,
        "redirect_uri": redirect_uri.strip(),
        "redirect": redirect.strip() if isinstance(redirect, str) else "",
        "nonce": payload.get("n"),
    }


async def build_gitee_oauth_authorize_url(
    *,
    redirect_uri: str,
    state: str,
    scope: str = GITEE_OAUTH_SCOPE,
) -> str:
    creds = await get_gitee_oauth_credentials()
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 Gitee OAuth（平台设置中填写 Client ID 与 Client Secret）",
        )
    query = urlencode(
        {
            "client_id": creds.client_id,
            "redirect_uri": redirect_uri.strip(),
            "response_type": "code",
            "scope": scope,
            "state": state,
        }
    )
    return f"{GITEE_AUTHORIZE_URL}?{query}"


async def exchange_gitee_code_for_access_token(*, code: str, redirect_uri: str) -> str:
    if not code or not str(code).strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少 OAuth code")
    creds = await get_gitee_oauth_credentials()
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 Gitee OAuth（平台设置中填写 Client ID 与 Client Secret）",
        )
    resp = await get_http_client().post(
        GITEE_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": str(code).strip(),
            "client_id": creds.client_id,
            "redirect_uri": redirect_uri.strip(),
            "client_secret": creds.client_secret,
        },
        headers={"Accept": "application/json"},
        timeout=15.0,
    )
    try:
        data = resp.json()
    except Exception as exc:
        logger.warning("Gitee token 响应非 JSON: {}", resp.text[:200] if resp.text else "")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Gitee 授权换票失败",
        ) from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Gitee 授权换票失败")
    token = data.get("access_token")
    if not isinstance(token, str) or not token.strip():
        err = data.get("error_description") or data.get("error") or data.get("message")
        logger.warning("Gitee token 失败: {}", data)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(err) if err else "Gitee 授权换票失败",
        )
    return token.strip()


def _is_usable_gitee_email(email: str | None) -> bool:
    if not email:
        return False
    return not email.endswith(_GITEE_NOREPLY_SUFFIX)


async def fetch_gitee_primary_email(*, access_token: str) -> str | None:
    """从 /api/v5/emails 取已确认主邮箱（公开邮箱为空时的唯一真源）。"""
    resp = await get_http_client().get(
        GITEE_EMAILS_API,
        params={"access_token": access_token},
        timeout=15.0,
    )
    if resp.status_code in (401, 403, 404):
        return None
    try:
        data = resp.json()
    except Exception:
        return None
    if isinstance(data, list):
        confirmed_primary: str | None = None
        confirmed_any: str | None = None
        primary_any: str | None = None
        for item in data:
            if not isinstance(item, dict):
                continue
            email = _normalize_email(
                item.get("email") if isinstance(item.get("email"), str) else None
            )
            if not email or not _is_usable_gitee_email(email):
                continue
            state = item.get("state")
            scopes = item.get("scope") if isinstance(item.get("scope"), list) else []
            is_primary = "primary" in scopes
            if state == "confirmed" and is_primary:
                confirmed_primary = email
                break
            if state == "confirmed" and confirmed_any is None:
                confirmed_any = email
            if is_primary and primary_any is None:
                primary_any = email
        return confirmed_primary or confirmed_any or primary_any
    if isinstance(data, dict):
        email = _normalize_email(
            data.get("email") if isinstance(data.get("email"), str) else None
        )
        return email if _is_usable_gitee_email(email) else None
    return None


async def fetch_gitee_user(*, access_token: str) -> dict[str, Any]:
    resp = await get_http_client().get(
        GITEE_USER_API,
        params={"access_token": access_token},
        timeout=15.0,
    )
    try:
        data = resp.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="获取 Gitee 用户信息失败",
        ) from exc
    if not isinstance(data, dict) or data.get("id") is None:
        logger.warning("Gitee user API 异常: {}", data)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未能获取 Gitee 用户标识",
        )
    email = _normalize_email(
        data.get("email") if isinstance(data.get("email"), str) else None
    )
    if not _is_usable_gitee_email(email):
        email = await fetch_gitee_primary_email(access_token=access_token)
        if email:
            data = {**data, "email": email}
    return data


def _extract_gitee_id(user: User) -> str | None:
    contact = user.contact_info if isinstance(user.contact_info, dict) else {}
    for key in _GITEE_ID_KEYS:
        value = contact.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _normalize_email(value: str | None) -> str | None:
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    if not text or text in _GITEE_EMAIL_PLACEHOLDERS:
        return None
    normalized = text.lower()
    if normalized in _GITEE_EMAIL_PLACEHOLDERS:
        return None
    return normalized


def _official_gitee_owner_repo() -> tuple[str, str]:
    slug = (OFFICIAL_GITEE_REPO_SLUG or "").strip().strip("/")
    parts = slug.split("/")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="官方 Gitee 仓库配置无效",
        )
    return parts[0], parts[1]


async def _list_starred_contains_official(*, access_token: str, owner: str, repo: str) -> bool | None:
    """
    列举授权用户 Star 列表，判断是否包含官方仓。
    成功判定返回 True/False；请求失败返回 None（由调用方决定是否降级）。
    """
    target = f"{owner}/{repo}".lower()
    saw_page = False
    for page in range(1, 4):
        try:
            resp = await get_http_client().get(
                GITEE_STARRED_LIST_API,
                params={
                    "access_token": access_token,
                    "per_page": 100,
                    "page": page,
                    "sort": "updated",
                },
                timeout=15.0,
                follow_redirects=False,
            )
        except Exception as exc:
            logger.warning("列举 Gitee Star 列表失败: {}", exc)
            return False if saw_page else None
        if resp.status_code != 200:
            logger.warning(
                "列举 Gitee Star 列表异常 status={} body={}",
                resp.status_code,
                (resp.text or "")[:200],
            )
            return False if saw_page else None
        try:
            items = resp.json()
        except Exception:
            return False if saw_page else None
        if not isinstance(items, list):
            return False if saw_page else None
        saw_page = True
        for item in items:
            if not isinstance(item, dict):
                continue
            full_name = str(item.get("full_name") or "").strip().lower()
            path_ns = str(item.get("path_with_namespace") or "").strip().lower()
            if full_name == target or path_ns == target:
                return True
            item_owner = item.get("namespace") if isinstance(item.get("namespace"), dict) else None
            owner_path = str((item_owner or {}).get("path") or "").strip().lower()
            item_path = str(item.get("path") or item.get("name") or "").strip().lower()
            if owner_path and item_path and f"{owner_path}/{item_path}" == target:
                return True
        if len(items) < 100:
            break
    return False if saw_page else None


def _response_is_official_repo_object(data: object, *, owner: str, repo: str) -> bool:
    """点查返回 200 时，仅当 body 为官方仓库对象才视为已 Star（避免空 200/错误 JSON 假阳性）。"""
    if not isinstance(data, dict):
        return False
    if data.get("message") or data.get("error") or data.get("error_description"):
        return False
    target = f"{owner}/{repo}".lower()
    full_name = str(data.get("full_name") or "").strip().lower()
    path_ns = str(data.get("path_with_namespace") or "").strip().lower()
    if full_name == target or path_ns == target:
        return True
    # 部分响应只有 id + name/path
    if data.get("id") is None:
        return False
    name = str(data.get("path") or data.get("name") or "").strip().lower()
    ns = data.get("namespace") if isinstance(data.get("namespace"), dict) else None
    ns_path = str((ns or {}).get("path") or "").strip().lower()
    if ns_path and name and f"{ns_path}/{name}" == target:
        return True
    return False


async def check_user_starred_official_repo(*, access_token: str) -> bool:
    """
    检查授权用户是否已 Star 官方仓库 kuaigeyun/kuaigeyun。

    判定（避免已 Star/未 Star 双向误判）：
    - 204 → 已 Star
    - 404 → 未 Star（以点查为准，不再用列表覆盖，防止取消 Star 后假阳性）
    - 200 → 仅当 body 为官方仓库对象才算已 Star；空体再用列表确认
    - 其它状态 → 仅列表命中才算已 Star
    """
    try:
        owner, repo = _official_gitee_owner_repo()
    except HTTPException:
        logger.warning("官方 Gitee 仓库 slug 无效: {}", OFFICIAL_GITEE_REPO_SLUG)
        return False
    resp = await get_http_client().get(
        GITEE_STARRED_API.format(owner=owner, repo=repo),
        params={"access_token": access_token},
        timeout=15.0,
        follow_redirects=False,
    )
    if resp.status_code == 204:
        return True
    if resp.status_code == 404:
        return False
    if resp.status_code == 200:
        raw = (resp.text or "").strip()
        if raw:
            try:
                data = resp.json()
            except Exception:
                data = None
            deprecated = _gitee_star_api_deprecated_message(data)
            if deprecated:
                # 点查接口已下线：无法服务端核实，交由前端引导官网 Star + 用户确认
                logger.info("Gitee Star 点查接口已废弃，跳过服务端核实: {}", deprecated)
                return False
            if _response_is_official_repo_object(data, owner=owner, repo=repo):
                return True
            logger.info(
                "Gitee Star 点查 200 但非仓库对象，按未 Star 处理 body={}",
                raw[:200],
            )
            return False
        listed = await _list_starred_contains_official(
            access_token=access_token, owner=owner, repo=repo
        )
        return listed is True
    logger.warning(
        "检查 Gitee Star 状态异常 status={} body={}",
        resp.status_code,
        (resp.text or "")[:200],
    )
    listed = await _list_starred_contains_official(
        access_token=access_token, owner=owner, repo=repo
    )
    return listed is True


def _gitee_star_api_deprecated_message(data: object) -> str | None:
    """Gitee 已下线 Star 读写接口时，响应 message 含「废弃」等字样。"""
    if not isinstance(data, dict):
        return None
    msg = data.get("message") or data.get("error_description") or data.get("error")
    if not isinstance(msg, str) or not msg.strip():
        return None
    text = msg.strip()
    if "废弃" in text or "下线" in text or "官网操作" in text:
        return text
    return None


async def star_official_repo(*, access_token: str) -> bool:
    """
    尝试通过 API Star 官方仓库。
    注意：Gitee 已废弃 Star 相关接口，成功路径基本不可用；若返回废弃提示须明确失败，禁止当成功。
    """
    if not access_token or not str(access_token).strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少 Gitee 授权令牌")
    owner, repo = _official_gitee_owner_repo()
    token = str(access_token).strip()
    resp = await get_http_client().put(
        GITEE_STARRED_API.format(owner=owner, repo=repo),
        params={"access_token": token},
        timeout=15.0,
        follow_redirects=False,
    )
    deprecated = None
    try:
        deprecated = _gitee_star_api_deprecated_message(resp.json())
    except Exception:
        deprecated = None
    if deprecated:
        logger.warning("Gitee Star API 已废弃，无法代点 Star: {}", deprecated)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gitee 已关闭 Star 接口，请前往官网仓库点 Star 后回来确认",
        )
    # 204 新建 Star；部分环境对已 Star 返回 204
    if resp.status_code == 204:
        return True
    if resp.status_code == 200:
        # 仅空体或仓库对象可视为成功；带 message 的 200 不当成功
        raw = (resp.text or "").strip()
        if not raw:
            return True
        try:
            data = resp.json()
        except Exception:
            data = None
        if _response_is_official_repo_object(data, owner=owner, repo=repo):
            return True
    if resp.status_code in (404, 422):
        if await check_user_starred_official_repo(access_token=token):
            return True
    logger.warning(
        "Gitee Star 官方仓库失败 status={} body={}",
        resp.status_code,
        (resp.text or "")[:200],
    )
    detail = "Star 官方仓库失败，请前往 Gitee 官网点 Star"
    try:
        data = resp.json()
        if isinstance(data, dict):
            msg = data.get("message") or data.get("error_description") or data.get("error")
            if msg:
                detail = str(msg)
    except Exception:
        pass
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


async def find_user_by_gitee_id(*, tenant_id: int, gitee_id: str) -> User | None:
    target = str(gitee_id).strip()
    if not target:
        return None
    users = await User.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    )
    for user in users:
        bound = _extract_gitee_id(user)
        if bound and bound == target:
            return user
    return None


async def bind_gitee_id_to_user(*, user: User, gitee_id: str, gitee_login: str | None = None) -> User:
    bound = str(gitee_id).strip()
    if not bound:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gitee 用户 ID 无效")
    existing = _extract_gitee_id(user)
    if existing and existing != bound:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该账号已绑定其他 Gitee 用户",
        )
    contact = dict(user.contact_info) if isinstance(user.contact_info, dict) else {}
    contact["gitee_id"] = bound
    if gitee_login and isinstance(gitee_login, str) and gitee_login.strip():
        contact["gitee_login"] = gitee_login.strip()
    user.contact_info = contact
    await user.save(update_fields=["contact_info", "updated_at"])
    return user


async def unbind_gitee_from_user(*, user: User) -> User:
    contact = dict(user.contact_info) if isinstance(user.contact_info, dict) else {}
    for key in (*_GITEE_ID_KEYS, "gitee_login"):
        contact.pop(key, None)
    user.contact_info = contact
    await user.save(update_fields=["contact_info", "updated_at"])
    return user


def build_gitee_profile_preview(gitee_user: dict[str, Any]) -> dict[str, Any]:
    raw_id = gitee_user.get("id")
    gitee_id = str(raw_id).strip() if raw_id is not None else ""
    login = gitee_user.get("login") if isinstance(gitee_user.get("login"), str) else None
    email = _normalize_email(gitee_user.get("email") if isinstance(gitee_user.get("email"), str) else None)
    name = None
    for key in ("name", "login"):
        value = gitee_user.get(key)
        if isinstance(value, str) and value.strip():
            name = value.strip()
            break
    avatar = gitee_user.get("avatar_url") if isinstance(gitee_user.get("avatar_url"), str) else None
    return {
        "id": gitee_id,
        "login": login.strip() if login else None,
        "email": email,
        "name": name,
        "avatar_url": avatar.strip() if avatar else None,
        "starred_official_repo": False,
    }


def encode_gitee_link_ticket(
    *,
    secret: str,
    tenant_id: int,
    gitee_id: str,
    login: str | None = None,
    email: str | None = None,
    name: str | None = None,
    avatar_url: str | None = None,
    access_token: str | None = None,
    ttl_seconds: int = 600,
) -> str:
    payload = {
        "t": tenant_id,
        "gid": str(gitee_id).strip(),
        "login": (login or "").strip(),
        "email": (email or "").strip(),
        "name": (name or "").strip(),
        "avatar": (avatar_url or "").strip(),
        # 短时令牌：仅供弹窗内 Star 官方仓，勿下发明文给其它接口
        "at": (access_token or "").strip(),
        "exp": int(time.time()) + max(60, ttl_seconds),
        "n": secrets.token_urlsafe(8),
    }
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    body = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    sig = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{sig}"


def decode_gitee_link_ticket(*, secret: str, ticket: str) -> dict[str, Any]:
    if not ticket or "." not in ticket:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联凭证无效或已过期")
    body, sig = ticket.rsplit(".", 1)
    expect = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(expect, sig):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联凭证无效或已过期")
    padded = body + "=" * (-len(body) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="关联凭证无效或已过期"
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联凭证无效或已过期")
    try:
        exp = int(payload.get("exp"))
        tenant_id = int(payload.get("t"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="关联凭证无效或已过期"
        ) from exc
    if exp < int(time.time()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联凭证已过期，请重新授权")
    gitee_id = str(payload.get("gid") or "").strip()
    if tenant_id <= 0 or not gitee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联凭证无效或已过期")
    return {
        "tenant_id": tenant_id,
        "gitee_id": gitee_id,
        "login": str(payload.get("login") or "").strip() or None,
        "email": _normalize_email(str(payload.get("email") or "") or None),
        "name": str(payload.get("name") or "").strip() or None,
        "avatar_url": str(payload.get("avatar") or "").strip() or None,
        "access_token": str(payload.get("at") or "").strip() or None,
    }


async def resolve_user_for_gitee_login(*, tenant_id: int, gitee_user: dict[str, Any]) -> User | None:
    """
    Gitee 登录用户解析：仅返回已绑定用户；未绑定由前端信息补全窗关联账号（不自动绑定）。
    """
    raw_id = gitee_user.get("id")
    gitee_id = str(raw_id).strip() if raw_id is not None else ""
    if not gitee_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未能获取 Gitee 用户标识")
    return await find_user_by_gitee_id(tenant_id=tenant_id, gitee_id=gitee_id)


def _sanitize_gitee_username_candidate(raw: str | None, *, gitee_id: str) -> str:
    """从 Gitee login 生成合法系统用户名候选（2–50，字母数字下划线）。"""
    import re

    base = re.sub(r"[^a-zA-Z0-9_]", "_", (raw or "").strip())
    base = re.sub(r"_+", "_", base).strip("_")
    if len(base) < 2:
        base = f"gitee_{gitee_id}"[:50]
    return base[:50]


async def _allocate_unique_username(*, tenant_id: int, preferred: str, gitee_id: str) -> str:
    from infra.domain.security.reserved_username import is_reserved_username

    candidates: list[str] = [preferred]
    if preferred != f"gitee_{gitee_id}"[:50]:
        candidates.append(f"gitee_{gitee_id}"[:50])
    for i in range(2, 30):
        suffix = f"_{i}"
        stem = preferred[: max(2, 50 - len(suffix))]
        candidates.append(f"{stem}{suffix}")
    for name in candidates:
        if len(name) < 2 or is_reserved_username(name):
            continue
        exists = await User.get_or_none(
            tenant_id=tenant_id,
            username=name,
            deleted_at__isnull=True,
        )
        if not exists:
            return name
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="无法分配可用用户名，请改用「绑定已有账户」",
    )


async def provision_user_for_gitee_first_login(
    *,
    tenant_id: int,
    gitee_id: str,
    login: str | None,
    email: str | None,
    name: str | None,
    username: str,
    password: str,
    phone: str | None = None,
    user_email: str | None = None,
) -> User:
    """
    Gitee 首次登录：在当前组织创建系统用户并绑定 Gitee（用户名/密码由用户在首次登录窗确认）。
    """
    from infra.domain.tenant.tenant_access import require_operational_tenant_by_id
    from infra.schemas.user import UserCreate
    from infra.services.auth_service import AuthService
    from infra.services.user_service import UserService

    await require_operational_tenant_by_id(tenant_id)
    occupied = await find_user_by_gitee_id(tenant_id=tenant_id, gitee_id=gitee_id)
    if occupied:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该 Gitee 账号已绑定其他用户，请直接使用 Gitee 登录",
        )
    from infra.domain.security.reserved_username import assert_tenant_user_username_allowed

    uname = assert_tenant_user_username_allowed(username.strip())
    taken = await User.get_or_none(
        tenant_id=tenant_id,
        username=uname,
        deleted_at__isnull=True,
    )
    if taken:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在，请修改后重试",
        )
    resolved_email = user_email if user_email else email
    user_service = UserService()
    user = await user_service.create_user(
        UserCreate(
            username=uname,
            phone=phone,
            email=resolved_email,
            password=password,
            full_name=(name or login or username)[:100],
            tenant_id=tenant_id,
            is_active=True,
            is_infra_admin=False,
            is_tenant_admin=False,
            source="gitee",
        ),
        tenant_id=tenant_id,
    )
    await bind_gitee_id_to_user(user=user, gitee_id=gitee_id, gitee_login=login)
    auth = AuthService()
    tenant = await require_operational_tenant_by_id(tenant_id)
    if auth._is_default_tenant(tenant):
        await auth._ensure_user_has_guest_role(user.id, tenant_id)
    return user


async def bind_gitee_for_current_user(
    *,
    tenant_id: int,
    user: User,
    gitee_user: dict[str, Any],
) -> User:
    if user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="组织上下文不匹配")
    raw_id = gitee_user.get("id")
    gitee_id = str(raw_id).strip() if raw_id is not None else ""
    login = gitee_user.get("login") if isinstance(gitee_user.get("login"), str) else None
    existing = await find_user_by_gitee_id(tenant_id=tenant_id, gitee_id=gitee_id)
    if existing and existing.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该 Gitee 账号已绑定其他用户",
        )
    return await bind_gitee_id_to_user(user=user, gitee_id=gitee_id, gitee_login=login)


async def unbind_gitee_for_current_user(*, tenant_id: int, user: User) -> User:
    if user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="组织上下文不匹配")
    if not _extract_gitee_id(user):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前账号未绑定 Gitee")
    return await unbind_gitee_from_user(user=user)
