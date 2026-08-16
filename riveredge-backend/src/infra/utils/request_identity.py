"""从 Request 读取已认证用户 ID（state 缓存或 Authorization Bearer）。"""

from typing import Optional

from fastapi import Request


def get_request_user_id(request: Request) -> Optional[int]:
    state = getattr(request, "state", None)
    if state is not None:
        cached = getattr(state, "user_id", None)
        if cached is not None:
            try:
                return int(cached)
            except (ValueError, TypeError):
                pass

    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None

    from infra.domain.security.security import get_token_payload

    payload = get_token_payload(authorization[7:])
    if not payload:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        return int(sub)
    except (ValueError, TypeError):
        return None
