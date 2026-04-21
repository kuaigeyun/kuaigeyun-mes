"""
全局共享的 httpx.AsyncClient 单例

大多数模块以前会在每次请求里 `async with httpx.AsyncClient(...) as client:`，
这会频繁新建 TCP 连接池、握手 TLS、解析 DNS，浪费资源。

本模块提供一个按 FastAPI lifespan 管理的全局 AsyncClient，调用方改为：

    from infra.infrastructure.http import get_http_client
    client = get_http_client()
    response = await client.get(url, timeout=3.0)

每次调用可以通过 ``timeout=`` / ``headers=`` / ``auth=`` 等参数覆盖默认行为，
不再需要 ``async with``。
"""

from __future__ import annotations

from typing import Optional

import httpx
from loguru import logger


_DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_DEFAULT_LIMITS = httpx.Limits(max_keepalive_connections=20, max_connections=100)

_client: Optional[httpx.AsyncClient] = None


def init_http_client() -> httpx.AsyncClient:
    """初始化全局 AsyncClient（由 lifespan 调用）。"""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=_DEFAULT_TIMEOUT,
            limits=_DEFAULT_LIMITS,
            follow_redirects=True,
        )
        logger.info("✅ 全局 httpx.AsyncClient 已初始化")
    return _client


async def close_http_client() -> None:
    """关闭全局 AsyncClient（由 lifespan 关闭阶段调用）。"""
    global _client
    if _client is not None and not _client.is_closed:
        try:
            await _client.aclose()
            logger.info("✅ 全局 httpx.AsyncClient 已关闭")
        except Exception as e:
            logger.warning(f"关闭全局 httpx.AsyncClient 时出错: {e}")
    _client = None


def get_http_client() -> httpx.AsyncClient:
    """取用全局 AsyncClient；首次调用若尚未初始化则即时初始化。"""
    if _client is None or _client.is_closed:
        return init_http_client()
    return _client
