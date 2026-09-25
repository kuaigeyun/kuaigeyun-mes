"""
金蝶云苍穹 / 金蝶AI OpenAPI 连接（增强型 Token）。

鉴权：POST /kapi/oauth2/getToken
请求头须带 x-acgw-identity；业务调用再带 access_token。
文档：vip.kingdee.com 知识「OpenAPI开发认证指南」「增强型Token认证」
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Dict, Optional

from core.services.integration.kingdee_cosmic_paths import (
    normalize_kingdee_cosmic_api_path,
    strip_kingdee_cosmic_ierp_suffix_from_base,
)

KINGDEE_COSMIC_GET_TOKEN_PATH = "/kapi/oauth2/getToken"
KINGDEE_COSMIC_VERIFY_TOKEN_PATH = "/kapi/oauth2/verifyToken"


def normalize_kingdee_cosmic_base_url(base_url: str) -> str:
    """门户/环境根地址，不含 /K3Cloud/（与星空 WebAPI 不同）。"""
    url = str(base_url or "").strip().rstrip("/")
    if not url:
        raise ValueError(
            "请填写 Base URL（金蝶AI/苍穹租户门户根地址，例如 https://xxx.kdgalaxy.com，不要拼 /K3Cloud/）"
        )
    if url.lower().endswith("/k3cloud"):
        raise ValueError(
            "金蝶AI苍穹 OpenAPI 不要使用 /K3Cloud/ 路径；请填写门户根地址（如 https://xxx.kdgalaxy.com）"
        )
    return url


def build_kingdee_cosmic_get_token_url(base_url: str) -> str:
    root = strip_kingdee_cosmic_ierp_suffix_from_base(
        normalize_kingdee_cosmic_base_url(base_url)
    )
    return f"{root}{KINGDEE_COSMIC_GET_TOKEN_PATH}"


def _config_str(config: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = config.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text and text != "****":
            return text
    return ""


def _build_nonce() -> str:
    return uuid.uuid4().hex


def _build_timestamp() -> str:
    """与官方示例一致：站点墙钟 YYYY-MM-DD HH:MM:SS（5 分钟内有效）。"""
    from core.utils.timezone_utils import resolve_business_datetime, to_site_timezone

    return to_site_timezone(resolve_business_datetime()).strftime("%Y-%m-%d %H:%M:%S")


def build_kingdee_cosmic_get_token_payload(config: Dict[str, Any]) -> Dict[str, Any]:
    client_id = _config_str(config, "client_id", "app_id")
    client_secret = _config_str(config, "client_secret", "app_secret")
    username = _config_str(config, "username")
    account_id = _config_str(config, "account_id", "accountId", "acct_id")
    language = _config_str(config, "language") or "zh_CN"
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "username": username,
        "accountId": account_id,
        "language": language,
        "nonce": _build_nonce(),
        "timestamp": _build_timestamp(),
    }


def build_kingdee_cosmic_gateway_headers(
    config: Dict[str, Any],
    *,
    access_token: Optional[str] = None,
) -> Dict[str, str]:
    identity = _config_str(config, "x_acgw_identity", "x-acgw-identity")
    if not identity:
        raise ValueError("请填写 x-acgw-identity（第三方应用详情中的系统身份标识）")
    headers: Dict[str, str] = {
        "Content-Type": "application/json",
        "x-acgw-identity": identity,
    }
    account_id = _config_str(config, "account_id", "accountId", "acct_id")
    if account_id:
        headers["accountId"] = account_id
    token = str(access_token or "").strip()
    if token:
        headers["access_token"] = token
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _secret_diag(secret: str) -> str:
    """不泄露密钥内容，仅长度与是否纯 ASCII，便于排查粘贴/全角问题。"""
    text = str(secret or "")
    if not text:
        return "secret_len=0"
    ascii_ok = all(ord(ch) < 128 for ch in text)
    return f"secret_len={len(text)}, secret_ascii={'yes' if ascii_ok else 'no'}"


def parse_kingdee_cosmic_token_response(
    payload: Any,
    *,
    client_id: str = "",
    client_secret: str = "",
    username: str = "",
    identity: str = "",
) -> tuple[bool, str, Optional[Dict[str, Any]]]:
    if not isinstance(payload, dict):
        return False, "金蝶 OpenAPI 登录响应无法识别", None

    error_code = str(payload.get("errorCode") or payload.get("error_code") or "").strip()
    status = payload.get("status")
    message = str(payload.get("message") or payload.get("msg") or "").strip()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    ok = (status is True or str(status).lower() == "true" or error_code == "0") and bool(
        data.get("access_token")
    )
    if ok:
        return True, message or "金蝶AI苍穹 OpenAPI 登录成功", data

    diag = (
        f"client_id={client_id!r}, username={username!r}, "
        f"{_secret_diag(client_secret)}, identity_len={len(identity or '')}"
    )
    if error_code == "401" or "密钥验证失败" in message or "client_secret" in message or "已锁定" in message:
        hint = (
            f"{message or 'client_id 或 client_secret 不正确'}。"
            f"诊断：{diag}。"
            "说明：金蝶把「密钥错误 / 密钥未在金蝶侧保存成功 / 代理用户名不对」都报成同一句。"
            "请确认：① AccessToken认证密钥已通过复杂度校验并点确定+保存应用；"
            "② 连接器 client_secret 与金蝶密钥完全一致（编辑时须重新粘贴，留空不会更新）；"
            "③ 代理用户名已在第三方应用「代理用户」中授权；"
            "④ 若提示已锁定，等待 180 秒后再测；"
            "⑤ 建议新建纯英文系统编码应用（如 MES_DJ）重配"
        )
        return False, hint, None
    if error_code == "603":
        return False, (message or "请求参数错误") + f"。诊断：{diag}", None
    if message:
        return False, f"{message}。诊断：{diag}", None
    return False, f"金蝶 OpenAPI 获取 access_token 失败。诊断：{diag}", None


async def _request_kingdee_cosmic_access_token(config: Dict[str, Any]) -> Dict[str, Any]:
    """内部：调用 getToken，成功返回含 access_token 的 data 与元信息。"""
    try:
        base_url = normalize_kingdee_cosmic_base_url(
            _config_str(config, "base_url", "url")
        )
    except ValueError as exc:
        return {"success": False, "message": str(exc)}

    client_id = _config_str(config, "client_id", "app_id")
    client_secret = _config_str(config, "client_secret", "app_secret")
    username = _config_str(config, "username")
    account_id = _config_str(config, "account_id", "accountId", "acct_id")
    identity = _config_str(config, "x_acgw_identity", "x-acgw-identity")

    if not account_id:
        return {"success": False, "message": "请填写 accountId（数据中心 ID）"}
    if not client_id:
        return {"success": False, "message": "请填写 client_id / appId（第三方应用系统编码）"}
    if not client_secret:
        return {
            "success": False,
            "message": (
                "client_secret 为空：请重新编辑连接器并粘贴 AccessToken 认证密钥后保存。"
                "（不要填 x-acgw-identity；编辑时若密钥框为空表示沿用旧值，旧值错误须重新粘贴）"
            ),
        }
    if not username:
        return {"success": False, "message": "请填写代理用户名（第三方应用代理用户）"}
    if not identity:
        return {"success": False, "message": "请填写 x-acgw-identity（系统身份标识）"}

    token_url = build_kingdee_cosmic_get_token_url(base_url)
    body = build_kingdee_cosmic_get_token_payload(config)
    try:
        headers = build_kingdee_cosmic_gateway_headers(config)
    except ValueError as exc:
        return {"success": False, "message": str(exc)}

    from infra.infrastructure.http import get_http_client

    client = get_http_client()
    try:
        resp = await client.post(
            token_url,
            content=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={**headers, "Content-Type": "application/json; charset=utf-8"},
            timeout=30.0,
        )
    except Exception as exc:
        return {"success": False, "message": f"无法连接金蝶 OpenAPI 地址：{exc}"}

    raw_text = (resp.text or "").strip()
    if resp.status_code >= 500:
        return {"success": False, "message": f"金蝶服务返回 HTTP {resp.status_code}"}
    if not raw_text:
        return {
            "success": False,
            "message": "金蝶 getToken 返回空响应，请检查 Base URL 是否为门户根地址",
        }

    content_type = (resp.headers.get("content-type") or "").lower()
    looks_like_html = (
        "html" in content_type
        or raw_text[:32].lower().lstrip().startswith("<!DOCTYPE html")
        or raw_text[:6].lower() == "<html>"
    )
    if looks_like_html:
        return {
            "success": False,
            "message": (
                f"金蝶地址返回了网页（HTTP {resp.status_code}），"
                "请确认 Base URL 为门户根地址（如 https://xxx.kdgalaxy.com），"
                "不要拼 /K3Cloud/"
            ),
        }

    try:
        payload = resp.json()
    except Exception:
        return {"success": False, "message": f"金蝶 getToken 响应非 JSON：{raw_text[:200]}"}

    ok, message, data = parse_kingdee_cosmic_token_response(
        payload,
        client_id=client_id,
        client_secret=client_secret,
        username=username,
        identity=identity,
    )
    if not ok or not data:
        return {"success": False, "message": message}

    return {
        "success": True,
        "message": message,
        "token_url": token_url,
        "data": data,
    }


async def test_kingdee_cosmic_connection_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """调用 /kapi/oauth2/getToken 校验苍穹 OpenAPI 连接器（不回传 token 明文）。"""
    result = await _request_kingdee_cosmic_access_token(config)
    if not result.get("success"):
        return {"success": False, "message": result.get("message") or "连接失败"}
    data = result.get("data") if isinstance(result.get("data"), dict) else {}
    return {
        "success": True,
        "message": result.get("message") or "金蝶AI苍穹 OpenAPI 登录成功",
        "token_url": result.get("token_url"),
        "token_type": data.get("token_type") or "Bearer",
        "expires_in": data.get("expires_in"),
    }


async def login_kingdee_cosmic_session(config: Dict[str, Any]) -> Dict[str, Any]:
    """getToken 并返回会话字段；失败 raise ValueError。"""
    result = await _request_kingdee_cosmic_access_token(config)
    if not result.get("success"):
        raise ValueError(str(result.get("message") or "金蝶AI苍穹 OpenAPI 登录失败"))
    data = result.get("data") if isinstance(result.get("data"), dict) else {}
    access_token = str(data.get("access_token") or "").strip()
    if not access_token:
        raise ValueError("金蝶 getToken 成功但未返回 access_token")
    return {
        "access_token": access_token,
        "token_type": str(data.get("token_type") or "Bearer"),
        "expires_in": data.get("expires_in"),
        "id_token": data.get("id_token"),
        "token_url": result.get("token_url"),
        "message": result.get("message") or "金蝶AI苍穹 OpenAPI 登录成功",
    }


def apply_kingdee_cosmic_session_headers(
    headers: Optional[Dict[str, Any]],
    *,
    config: Dict[str, Any],
    access_token: str,
) -> Dict[str, Any]:
    """业务 OpenAPI 调用须携带 x-acgw-identity + access_token。"""
    merged = dict(headers or {})
    auth_headers = build_kingdee_cosmic_gateway_headers(config, access_token=access_token)
    merged.update(auth_headers)
    return merged
