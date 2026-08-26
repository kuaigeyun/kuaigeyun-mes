"""应用连接器 REST 请求解析（数据集 / 接口管理共用）。"""

from __future__ import annotations

from typing import Any, Dict, Optional, TYPE_CHECKING

from infra.exceptions.exceptions import ValidationError

if TYPE_CHECKING:
    from core.models.integration_config import IntegrationConfig


def resolve_connector_request(
    integration_config: "IntegrationConfig",
    *,
    endpoint: str,
    headers: Optional[Dict[str, Any]] = None,
) -> tuple[str, Dict[str, Any]]:
    """
    根据连接器配置解析完整 URL 与鉴权请求头。

    base_url 缺失时直接报错，不回落本机 BASE_URL。
    """
    cfg = integration_config.get_config()
    base_url = (cfg.get("base_url") or cfg.get("url") or "").strip().rstrip("/")
    if not base_url:
        raise ValidationError("应用连接器配置缺少 base_url 或 url")

    endpoint_str = (endpoint or "").strip()
    if endpoint_str.startswith("http://") or endpoint_str.startswith("https://"):
        url = endpoint_str
    elif endpoint_str:
        url = f"{base_url}/{endpoint_str.lstrip('/')}"
    else:
        url = base_url

    merged_headers: Dict[str, Any] = dict(cfg.get("headers") or {})
    if cfg.get("auth_type") == "bearer" and cfg.get("token"):
        merged_headers["Authorization"] = f"Bearer {cfg['token']}"
    if headers:
        merged_headers.update(headers)

    return url, merged_headers
