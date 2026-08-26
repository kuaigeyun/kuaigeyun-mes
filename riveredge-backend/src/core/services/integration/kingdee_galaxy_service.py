"""
金蝶云星空（K3Cloud）WebAPI 连接测试。

鉴权接口：LoginByAppSecret
文档：https://openapi.open.kingdee.com/ApiDoc
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Optional, Tuple

KINGDEE_LOGIN_PATH = (
    "Kingdee.BOS.WebApi.ServicesStub.AuthService.LoginByAppSecret.common.kdsvc"
)


def normalize_kingdee_galaxy_base_url(base_url: str) -> str:
    """金蝶 WebAPI base_url 须非空且以 / 结尾（常见为 https://host/K3Cloud/）。"""
    url = str(base_url or "").strip()
    if not url:
        raise ValueError(
            "请填写 Base URL（金蝶云星空站点地址，须以 /K3Cloud/ 或 /k3cloud/ 结尾，例如 https://xxx/K3Cloud/）"
        )
    if not url.endswith("/"):
        url += "/"
    return url


def build_kingdee_login_url(base_url: str) -> str:
    return f"{normalize_kingdee_galaxy_base_url(base_url)}{KINGDEE_LOGIN_PATH}"


def build_kingdee_login_payload(
    *,
    acct_id: str,
    username: str,
    app_id: str,
    app_secret: str,
    lcid: str | int = "2052",
) -> Dict[str, Any]:
    """金蝶 .common.kdsvc 标准报文（parameters 顺序固定）。"""
    return {
        "format": 1,
        "useragent": "ApiClient",
        "rid": str(uuid.uuid4()),
        "parameters": [
            str(acct_id).strip(),
            str(username).strip(),
            str(app_id).strip(),
            str(app_secret).strip(),
            str(lcid).strip() or "2052",
        ],
        "timestamp": str(int(time.time())),
        "v": "1.0",
    }


def _extract_response_status(payload: Any) -> Tuple[Optional[bool], str]:
    if not isinstance(payload, dict):
        return None, ""
    result = payload.get("Result")
    if isinstance(result, dict):
        status = result.get("ResponseStatus")
        if isinstance(status, dict):
            is_success = status.get("IsSuccess")
            errors = status.get("Errors") or []
            if errors and isinstance(errors, list):
                first = errors[0]
                if isinstance(first, dict):
                    msg = str(first.get("Message") or first.get("FieldName") or "").strip()
                    if msg:
                        return bool(is_success) if is_success is not None else None, msg
            msg = str(result.get("Message") or payload.get("Message") or "").strip()
            if is_success is not None:
                return bool(is_success), msg
    status = payload.get("ResponseStatus")
    if isinstance(status, dict) and status.get("IsSuccess") is not None:
        errors = status.get("Errors") or []
        if errors and isinstance(errors, list):
            first = errors[0]
            if isinstance(first, dict):
                msg = str(first.get("Message") or "").strip()
                if msg:
                    return bool(status.get("IsSuccess")), msg
        return bool(status.get("IsSuccess")), str(payload.get("Message") or "").strip()
    return None, str(payload.get("Message") or "").strip()


def _extract_login_result_type(payload: Any) -> Optional[int]:
    if not isinstance(payload, dict):
        return None
    result = payload.get("Result")
    if isinstance(result, dict) and result.get("LoginResultType") is not None:
        try:
            return int(result["LoginResultType"])
        except (TypeError, ValueError):
            return None
    if payload.get("LoginResultType") is not None:
        try:
            return int(payload["LoginResultType"])
        except (TypeError, ValueError):
            return None
    return None


def parse_kingdee_login_response(
    payload: Any,
    *,
    session_id: Optional[str] = None,
) -> Tuple[bool, str, Optional[str]]:
    """解析 LoginByAppSecret 响应，返回 (成功, 消息, session_id)。"""
    login_type = _extract_login_result_type(payload)
    if login_type == 1:
        return True, "金蝶云星空登录成功", session_id
    if login_type is not None and login_type != 1:
        return False, f"金蝶登录失败（LoginResultType={login_type}）", None

    is_success, message = _extract_response_status(payload)
    if is_success is True:
        return True, message or "金蝶云星空登录成功", session_id
    if is_success is False:
        return False, message or "金蝶登录失败，请检查账套 ID、集成用户名、应用 ID 与应用密钥", None

    if session_id:
        return True, "金蝶云星空登录成功", session_id

    return False, message or "金蝶登录响应无法识别，请检查 Base URL 与第三方系统登录授权配置", None


async def test_kingdee_galaxy_connection_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """调用 LoginByAppSecret 校验金蝶云星空连接器配置。"""
    base_url = str(config.get("base_url") or config.get("url") or "").strip()
    acct_id = str(config.get("acct_id") or "").strip()
    username = str(config.get("username") or config.get("user_name") or "").strip()
    app_id = str(config.get("app_id") or "").strip()
    app_secret = str(config.get("app_secret") or "").strip()
    lcid = str(config.get("lcid") or "2052").strip() or "2052"

    if not acct_id:
        return {"success": False, "message": "请填写账套 ID（Acct ID / 数据中心 ID）"}
    if not username:
        return {"success": False, "message": "请填写集成用户名（第三方系统登录授权中的用户名）"}
    if not app_id:
        return {"success": False, "message": "请填写 App ID"}
    if not app_secret:
        return {"success": False, "message": "请填写 App Secret"}

    login_url = build_kingdee_login_url(base_url)
    body = build_kingdee_login_payload(
        acct_id=acct_id,
        username=username,
        app_id=app_id,
        app_secret=app_secret,
        lcid=lcid,
    )

    from infra.infrastructure.http import get_http_client

    client = get_http_client()
    try:
        resp = await client.post(
            login_url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=30.0,
        )
    except Exception as exc:
        return {
            "success": False,
            "message": f"无法连接金蝶云星空地址：{exc}",
        }

    raw_text = (resp.text or "").strip()
    if resp.status_code >= 500:
        return {
            "success": False,
            "message": f"金蝶服务返回 HTTP {resp.status_code}",
        }
    if not raw_text:
        return {"success": False, "message": "金蝶登录接口返回空响应，请检查 Base URL 是否正确"}

    content_type = (resp.headers.get("content-type") or "").lower()
    if "html" in content_type and resp.status_code != 200:
        return {
            "success": False,
            "message": "金蝶地址返回 HTML 页面，请确认 Base URL 指向 K3Cloud 站点（以 /K3Cloud/ 结尾）",
        }

    try:
        payload = resp.json()
    except Exception:
        snippet = raw_text[:200]
        return {
            "success": False,
            "message": f"金蝶登录响应非 JSON：{snippet}",
        }

    session_id = resp.cookies.get("kdservice-sessionid")
    if not session_id:
        for key, value in resp.headers.items():
            if key.lower() == "kdservice-sessionid":
                session_id = value
                break

    ok, message, session_id = parse_kingdee_login_response(payload, session_id=session_id)
    if not ok:
        return {"success": False, "message": message}

    data: Dict[str, Any] = {"login_url": login_url}
    if session_id:
        data["session_id"] = session_id
    return {
        "success": True,
        "message": message,
        **data,
    }


async def login_kingdee_galaxy_session(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    LoginByAppSecret 并返回 session。

    成功时含 session_id；失败 raise ValueError（message 可读）。
    """
    result = await test_kingdee_galaxy_connection_config(config)
    if not result.get("success"):
        raise ValueError(str(result.get("message") or "金蝶云星空登录失败"))
    session_id = result.get("session_id")
    if not session_id:
        raise ValueError("金蝶登录成功但未返回会话（kdservice-sessionid），请检查站点 Cookie 策略")
    return {
        "session_id": str(session_id),
        "login_url": result.get("login_url"),
        "message": result.get("message") or "金蝶云星空登录成功",
    }


def apply_kingdee_galaxy_session_headers(
    headers: Optional[Dict[str, Any]],
    *,
    session_id: str,
) -> Dict[str, Any]:
    """业务接口调用须携带会话：Header 与 Cookie 双写，兼容不同网关。"""
    merged: Dict[str, Any] = dict(headers or {})
    sid = str(session_id).strip()
    if not sid:
        raise ValueError("金蝶会话为空")
    merged["Content-Type"] = merged.get("Content-Type") or "application/json"
    merged["kdservice-sessionid"] = sid
    cookie = str(merged.get("Cookie") or "").strip()
    token = f"kdservice-sessionid={sid}"
    if "kdservice-sessionid=" in cookie.lower():
        pass
    elif cookie:
        merged["Cookie"] = f"{cookie}; {token}"
    else:
        merged["Cookie"] = token
    return merged
