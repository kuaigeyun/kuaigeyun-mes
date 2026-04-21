"""HTTP 基础设施：全局共享的 httpx.AsyncClient 单例。"""

from infra.infrastructure.http.client import (
    get_http_client,
    init_http_client,
    close_http_client,
)

__all__ = ["get_http_client", "init_http_client", "close_http_client"]
