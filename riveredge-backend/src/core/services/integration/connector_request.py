"""应用连接器 REST 请求解析（数据集 / 接口管理共用）。"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, TYPE_CHECKING

from infra.exceptions.exceptions import ValidationError

_DUPLICATE_IERP_BEFORE_KAPI = re.compile(r"(?i)(?:/ierp)+(?=/kapi(?:/|$))")

_BASEDATA_SYS_QUERY_OBJECTS = {
    "bd_material",
    "bd_measureunits",
    "bd_materialgroup",
    "bd_supplier",
    "bd_customer",
    "bd_warehouse",
}


def _rewrite_basedata_sys_query_path(endpoint: str) -> str:
    ep = str(endpoint or "").strip().lstrip("/")
    if ep.lower().startswith("ierp/"):
        ep = ep[5:]
    lower = ep.lower()
    if lower == "kapi/v2/basedata/bd_supplier/batchquery":
        return "kapi/v2/basedata/bd_supplier/query"
    prefix = "kapi/sys/"
    suffix = "/query"
    if not lower.startswith(prefix) or not lower.endswith(suffix):
        return ep
    biz = lower[len(prefix) : -len(suffix)]
    if biz == "bd_supplier":
        return "kapi/v2/basedata/bd_supplier/query"
    if biz not in _BASEDATA_SYS_QUERY_OBJECTS:
        return ep
    return f"kapi/v2/basedata/{biz}/batchQuery"

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
    连接器已停用时拒绝发起请求。
    """
    if not bool(getattr(integration_config, "is_active", True)):
        name = str(getattr(integration_config, "name", "") or "").strip()
        raise ValidationError(
            f"应用连接器「{name}」已停用，无法调用" if name else "应用连接器已停用，无法调用"
        )

    cfg = integration_config.get_config()
    base_url = (cfg.get("base_url") or cfg.get("url") or "").strip().rstrip("/")
    if not base_url:
        raise ValidationError("应用连接器配置缺少 base_url 或 url")

    endpoint_str = _rewrite_basedata_sys_query_path((endpoint or "").strip().lstrip("/"))
    # 金蝶 AI 完整服务地址是「门户域名/kapi/请求地址」，请求地址以 /v2/ 开头，不含 /ierp。
    if base_url.lower().endswith("/ierp") and (
        endpoint_str.lower().startswith("kapi/") or endpoint_str.lower().startswith("ierp/")
    ):
        base_url = base_url[: -len("/ierp")]
    if endpoint_str.lower().startswith("ierp/"):
        endpoint_str = endpoint_str[5:]
    if endpoint_str.startswith("http://") or endpoint_str.startswith("https://"):
        url = endpoint_str
    elif endpoint_str:
        url = f"{base_url}/{endpoint_str}"
    else:
        url = base_url

    url = _DUPLICATE_IERP_BEFORE_KAPI.sub("/ierp", url)

    merged_headers: Dict[str, Any] = dict(cfg.get("headers") or {})
    if cfg.get("auth_type") == "bearer" and cfg.get("token"):
        merged_headers["Authorization"] = f"Bearer {cfg['token']}"
    if headers:
        merged_headers.update(headers)

    return url, merged_headers
