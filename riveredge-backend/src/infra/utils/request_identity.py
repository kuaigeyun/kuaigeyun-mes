"""从 Request 读取已认证用户 ID（state 缓存或 Authorization Bearer）。"""

from typing import Optional

from fastapi import Request


def _int_or_none(value: object) -> Optional[int]:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def get_request_user_id(request: Request) -> Optional[int]:
    state = getattr(request, "state", None)
    if state is not None:
        cached = _int_or_none(getattr(state, "user_id", None))
        if cached is not None:
            return cached

    payload = _token_payload(request)
    if not payload:
        return None
    return _int_or_none(payload.get("sub"))


def get_request_tenant_id(request: Request) -> Optional[int]:
    state = getattr(request, "state", None)
    if state is not None:
        cached = _int_or_none(getattr(state, "tenant_id", None))
        if cached is not None:
            return cached

    payload = _token_payload(request)
    if not payload:
        return None
    return _int_or_none(payload.get("tenant_id"))


def _token_payload(request: Request):
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None

    from infra.domain.security.security import get_token_payload

    return get_token_payload(authorization[7:])
