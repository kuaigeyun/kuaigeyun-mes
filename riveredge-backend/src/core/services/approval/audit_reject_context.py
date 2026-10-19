"""驳回请求内暂存 reject_target（供 reject_with_flow_fallback / execute_approval 读取）。"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Literal, Optional

RejectTarget = Literal["previous", "submitter"]

_reject_target: ContextVar[Optional[RejectTarget]] = ContextVar(
    "_reject_target",
    default=None,
)


def normalize_reject_target(raw: object) -> Optional[RejectTarget]:
    val = str(raw or "").strip().lower()
    if val in ("previous", "submitter"):
        return val  # type: ignore[return-value]
    return None


def set_reject_target(raw: object):
    return _reject_target.set(normalize_reject_target(raw))


def reset_reject_target(token) -> None:
    _reject_target.reset(token)


def get_reject_target() -> Optional[RejectTarget]:
    return _reject_target.get()
