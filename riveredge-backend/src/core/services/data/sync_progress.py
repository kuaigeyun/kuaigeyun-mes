"""同步进度上报：供流式接口把「正在处理什么」推到前端。"""

from __future__ import annotations

from contextvars import ContextVar, Token
from typing import Any, Awaitable, Callable, Optional

SyncProgressCallback = Callable[..., Awaitable[None]]

_progress_cb: ContextVar[Optional[SyncProgressCallback]] = ContextVar(
    "sync_progress_cb", default=None
)


def set_sync_progress_callback(callback: Optional[SyncProgressCallback]) -> Token:
    return _progress_cb.set(callback)


def reset_sync_progress_callback(token: Token) -> None:
    _progress_cb.reset(token)


async def emit_sync_progress(message: str, **extra: Any) -> None:
    callback = _progress_cb.get()
    if callback is None:
        return
    await callback(message=message, **extra)
