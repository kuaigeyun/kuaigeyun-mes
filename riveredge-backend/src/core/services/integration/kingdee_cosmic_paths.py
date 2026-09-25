"""金蝶AI苍穹 OpenAPI 路径约定（无重依赖，供 connector_request 等直接引用）。"""

from __future__ import annotations

from typing import Any, Dict


_BASEDATA_BATCH_OBJECTS = {
    "bd_material",
    "bd_measureunits",
    "bd_materialgroup",
    "bd_supplier",
    "bd_customer",
    "bd_warehouse",
}


def rewrite_basedata_sys_query_path(endpoint: str) -> str:
    """供应商查询是 /query；物料批量查询是 /batchQuery。"""
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
    if biz not in _BASEDATA_BATCH_OBJECTS:
        return ep
    return f"kapi/v2/basedata/{biz}/batchQuery"


def strip_kingdee_cosmic_ierp_suffix_from_base(base_url: str) -> str:
    """
    门户根地址有时误填为 …/ierp；业务与鉴权路径均相对门户根拼接，须先去掉尾部的 /ierp。
    """
    url = str(base_url or "").strip().rstrip("/")
    if url.lower().endswith("/ierp"):
        return url[: -len("/ierp")]
    return url


def ensure_kingdee_v2_request_body(url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    v2 批量查询的请求体为 data，以及必填的 pageNo、pageSize。
    筛选字段在 data 内；pageSize 为空时金蝶返回 400。
    """
    path = str(url or "").split("?", 1)[0].lower()
    if "/kapi/v2/" not in path:
        return body
    payload: Dict[str, Any] = dict(body) if isinstance(body, dict) else {}
    if "data" not in payload:
        paging = {
            key: payload.pop(key)
            for key in ("pageNo", "pageSize", "page_no", "page_size")
            if key in payload
        }
        payload = {"data": payload, **paging}
    if "batchquery" in path:
        if payload.get("pageNo") in (None, ""):
            payload["pageNo"] = 1
        if payload.get("pageSize") in (None, ""):
            payload["pageSize"] = 100
    return payload


def normalize_kingdee_cosmic_api_path(endpoint: str) -> str:
    """
    业务对象 sys/query 等在网关侧挂在 /ierp/kapi/sys/...；
    OAuth getToken 等仍为 /kapi/oauth2/...（不加 ierp 前缀）。
    """
    ep = str(endpoint or "").strip().lstrip("/")
    if not ep:
        return ep
    if ep.startswith("ierp/"):
        return ep
    if ep.startswith("kapi/sys/"):
        return f"ierp/{ep}"
    return ep
