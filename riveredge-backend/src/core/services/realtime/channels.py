"""Centrifugo / 实时频道命名（租户隔离）。"""

from __future__ import annotations


def personal_channel(*, tenant_id: int, user_id: int) -> str:
    return f"personal:t{int(tenant_id)}:u{int(user_id)}"


def tenant_scoped_channel(*, tenant_id: int, scope: str) -> str:
    name = (scope or "").strip()
    if not name:
        raise ValueError("scope 不能为空")
    return f"tenant:t{int(tenant_id)}:{name}"


def tenant_andon_channel(*, tenant_id: int) -> str:
    return tenant_scoped_channel(tenant_id=tenant_id, scope="andon")


def tenant_kuaiiot_channel(*, tenant_id: int) -> str:
    return tenant_scoped_channel(tenant_id=tenant_id, scope="kuaiiot")


def ai_session_channel(*, tenant_id: int, user_id: int, session_id: str) -> str:
    sid = (session_id or "").strip()
    if not sid:
        raise ValueError("session_id 不能为空")
    return f"ai:t{int(tenant_id)}:u{int(user_id)}:s{sid}"


def im_conversation_channel(*, tenant_id: int, conversation_uuid: str) -> str:
    cu = (conversation_uuid or "").strip()
    if not cu:
        raise ValueError("conversation_uuid 不能为空")
    return f"im:t{int(tenant_id)}:c{cu}"
