"""金蝶AI苍穹 OpenAPI 路径约定（无重依赖，供 connector_request 等直接引用）。"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


_BASEDATA_BATCH_OBJECTS = {
    "bd_material",
    "bd_measureunits",
    "bd_multimeasureunit",
    "bd_materialgroup",
    "bd_supplier",
    "bd_customer",
    "bd_warehouse",
}


_INCOMPLETE_SUPPLIER_PATH_MARKERS = frozenset(
    {
        "kapi/v2/basedata/b",
        "kapi/v2/basedata/bd",
        "v2/basedata/b",
    }
)
SUPPLIER_QUERY_ENDPOINT = "kapi/v2/basedata/bd_supplier/query"


def repair_incomplete_supplier_endpoint(endpoint: str) -> str:
    """
    接口库常见误存路径 …/basedata/b（缺 bd_supplier/query）。
    补全为制造链路探活地址，不是另猜路由。
    """
    ep = str(endpoint or "").strip().lstrip("/")
    lower = ep.lower().replace("\\", "/").rstrip("/")
    if lower in _INCOMPLETE_SUPPLIER_PATH_MARKERS or lower.endswith("/basedata/b"):
        return SUPPLIER_QUERY_ENDPOINT
    return ep


def normalize_cosmic_openapi_endpoint(endpoint: str) -> str:
    """相对路径：开放平台 /v2/… 补 kapi 前缀，旧 sys/query 按物料/客户规则改写。"""
    ep = str(endpoint or "").strip().lstrip("/")
    if ep.lower().startswith("v2/"):
        ep = f"kapi/{ep.lstrip('/')}"
    ep = rewrite_basedata_sys_query_path(ep)
    return repair_incomplete_supplier_endpoint(ep)


def strip_invalid_kingdee_cosmic_base_url_suffix(base_url: str) -> str:
    """
    连接器 base_url 误粘贴了接口路径（含截断的 …/basedata/b）时，剥回到门户根。
    """
    url = str(base_url or "").strip().rstrip("/")
    lower = url.lower()
    cut_markers = (
        "/kapi/v2/basedata/b",
        "/kapi/v2/basedata/bd_supplier/query",
        "/kapi/v2/basedata/bd_supplier/batchquery",
        "/kapi/v2/basedata/bd_material/batchquery",
    )
    for marker in cut_markers:
        idx = lower.find(marker)
        if idx > 0:
            return url[:idx].rstrip("/")
    return url


def rewrite_basedata_sys_query_path(endpoint: str) -> str:
    """
    旧 sys/query → v2。物料/客户/仓库等 batchQuery；供应商与 mfg 探活一致为 …/query。
    """
    ep = str(endpoint or "").strip().lstrip("/")
    if ep.lower().startswith("ierp/"):
        ep = ep[5:]
    lower = ep.lower()
    prefix = "kapi/sys/"
    suffix = "/query"
    if not lower.startswith(prefix) or not lower.endswith(suffix):
        return ep
    biz = lower[len(prefix) : -len(suffix)]
    if biz == "bd_supplier":
        return f"kapi/v2/basedata/{biz}/query"
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


def _kingdee_v2_needs_paging(path: str) -> bool:
    """v2 查询类接口普遍要求 pageNo/pageSize（含 query / batchQuery / batcheQuery）。"""
    lower = str(path or "").lower()
    if "/kapi/v2/" not in lower:
        return False
    # 写操作（save/submit/audit/delete 等）不要强塞分页
    write_markers = (
        "/save",
        "/batchsave",
        "/submit",
        "/audit",
        "/unaudit",
        "/delete",
        "/update",
        "/batchadd",
        "/batchupdate",
        "/batchdelete",
        "/batchsubmit",
        "/batchaudit",
        "/batchunaudit",
        "/batchunsubmit",
        "/transmit",
        "/beginwork",
        "/endwork",
        "/shut",
    )
    if any(marker in lower for marker in write_markers):
        return False
    return any(
        marker in lower
        for marker in (
            "batchquery",
            "batchequery",
            "batchquerynew",
            "/query",
            "/getlist",
        )
    )


def _is_flat_v2_query_path(path: str) -> bool:
    """请求体顶层筛选项 + pageNo/pageSize，勿包进 data（库存、商品分类 getMalGoodsClass 等）。"""
    lower = str(path or "").split("?", 1)[0].lower()
    return (
        "getinventory" in lower
        or "getinvacc" in lower
        or "/imrealbal" in lower
        or "getmalgoodsclass" in lower
        or "mdr_goodsclass" in lower
        or "/gmc/" in lower
    )


def ensure_kingdee_v2_request_body(url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    v2 批量查询的请求体为 data，以及必填的 pageNo、pageSize。
    筛选字段在 data 内；pageSize 为空时金蝶返回 400。

    即时库存、商品分类 getMalGoodsClass 等使用顶层字段（不是 data），不可强行包进 data。
    """
    path = str(url or "").split("?", 1)[0].lower()
    if "/kapi/v2/" not in path:
        return body
    payload: Dict[str, Any] = dict(body) if isinstance(body, dict) else {}
    is_inventory = "getinventory" in path or "getinvacc" in path or "/imrealbal" in path
    is_flat = _is_flat_v2_query_path(path)

    # 误把 params 包进 data 时还原（旧逻辑 / 手工编辑常见），否则金蝶 NPE
    data_obj = payload.get("data")
    if is_inventory and isinstance(data_obj, dict) and "params" in data_obj and "params" not in payload:
        nested_params = data_obj.pop("params")
        payload["params"] = nested_params
        if not data_obj:
            payload.pop("data", None)

    # 库存查询：{ params, pageNo, pageSize } —— 保留 params，勿包 data
    if is_inventory or ("params" in payload and "data" not in payload):
        if "params" in payload:
            if payload.get("pageNo") in (None, ""):
                payload["pageNo"] = 1
            if payload.get("pageSize") in (None, ""):
                payload["pageSize"] = 100
            # 库存接口禁止残留空 data，避免网关 NPE
            if payload.get("data") in (None, {}, []):
                payload.pop("data", None)
            return payload

    if is_flat:
        # 商品分类等：筛选字段与 pageNo/pageSize 同级；去掉误包的空 data
        if payload.get("data") in (None, {}, []):
            payload.pop("data", None)
        if payload.get("pageNo") in (None, ""):
            payload["pageNo"] = 1
        if payload.get("pageSize") in (None, ""):
            payload["pageSize"] = 100
        return payload

    if "data" not in payload:
        # 库存路径即使没有 params 也不要瞎包一层 data
        if is_inventory:
            if payload.get("pageNo") in (None, ""):
                payload["pageNo"] = 1
            if payload.get("pageSize") in (None, ""):
                payload["pageSize"] = 100
            return payload
        paging = {
            key: payload.pop(key)
            for key in ("pageNo", "pageSize", "page_no", "page_size")
            if key in payload
        }
        payload = {"data": payload, **paging}
    if _kingdee_v2_needs_paging(path):
        if payload.get("pageNo") in (None, ""):
            payload["pageNo"] = 1
        if payload.get("pageSize") in (None, ""):
            # 兼容金蝶偶发只认 page_size 的旧路径：主字段仍用 pageSize
            payload["pageSize"] = 100
        # 若误把 pageSize 写进 data，提到外层
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("pageNo", "pageSize", "page_no", "page_size"):
                if key in data and payload.get(key) in (None, ""):
                    payload[key] = data.pop(key)
            if payload.get("pageSize") in (None, "") and data.get("pageSize") not in (None, ""):
                payload["pageSize"] = data.pop("pageSize")
            if payload.get("pageNo") in (None, "") and data.get("pageNo") not in (None, ""):
                payload["pageNo"] = data.pop("pageNo")
    return payload


def resolve_kingdee_cosmic_createorg_number(cfg: Optional[Dict[str, Any]]) -> str:
    """连接器组织编码：仓库/供应商 basedata 查询的 createorg_number。"""
    data = cfg if isinstance(cfg, dict) else {}
    for key in ("createorg_number", "create_org_number", "org_number", "orgNumber"):
        val = str(data.get(key) or "").strip()
        if val:
            return val
    return ""


def _path_without_query(url: str) -> str:
    return str(url or "").split("?", 1)[0]


def _is_basedata_single_query(path: str) -> bool:
    lower = _path_without_query(path).lower()
    return "/basedata/" in lower and lower.endswith("/query") and "batchquery" not in lower


def _is_warehouse_path(path: str) -> bool:
    return "bd_warehouse" in _path_without_query(path).lower()


def prepare_kingdee_cosmic_outbound(
    cfg: Optional[Dict[str, Any]],
    url: str,
    method: str,
    params: Optional[Dict[str, Any]],
    body: Optional[Dict[str, Any]],
) -> Tuple[str, str, Dict[str, Any], Dict[str, Any]]:
    """
    仓库列表走 batchQuery，并把连接器组织编码写入 createorg_number。
    GET /bd_warehouse/query 且未指定 number 时改为 POST batchQuery。
    """
    params_out: Dict[str, Any] = dict(params or {})
    body_out: Dict[str, Any] = dict(body) if isinstance(body, dict) else {}
    method_out = str(method or "POST").upper() or "POST"
    url_out = str(url or "")
    lower_path = _path_without_query(url_out).lower()
    if "oauth2/gettoken" in lower_path:
        return method_out, url_out, params_out, body_out

    number = str(params_out.get("number") or "").strip()
    if _is_warehouse_path(url_out) and _is_basedata_single_query(url_out) and not number:
        url_out = re.sub(r"(?i)/query/?$", "/batchQuery", _path_without_query(url_out))
        method_out = "POST"
        params_out.pop("number", None)
    body_out = ensure_kingdee_v2_request_body(url_out, body_out)
    org = resolve_kingdee_cosmic_createorg_number(cfg)
    lower = _path_without_query(url_out).lower()
    data_obj = body_out.get("data") if isinstance(body_out.get("data"), dict) else {}
    already = str(params_out.get("createorg_number") or "").strip() or str(
        data_obj.get("createorg_number") or data_obj.get("createOrgNumber") or ""
    ).strip()
    createorg = already or org or ("WANG" if _is_warehouse_path(url_out) else "")

    if _is_warehouse_path(url_out) and "batchquery" in lower:
        data = dict(data_obj)
        data["createorg_number"] = createorg
        body_out["data"] = data
    elif _is_basedata_single_query(url_out) and createorg:
        params_out["createorg_number"] = createorg

    if "batchquery" in lower:
        method_out = "POST"
        # sys/query 改写为 batchQuery 时，把 select 落到请求体，避免仍拉全量返回列
        select_raw = params_out.get("select")
        if select_raw in (None, ""):
            select_raw = body_out.get("select")
        select_text = str(select_raw or "").strip()
        if select_text:
            body_out["select"] = select_text
            params_out["select"] = select_text

    return method_out, url_out, params_out, body_out


def _select_output_column(key: str) -> str:
    """点号 select 输出为下划线列名，便于前端映射（group.number → group_number）。"""
    raw = str(key or "").strip()
    return raw.replace(".", "_") if raw else raw


def _dig_nested_path(row: Dict[str, Any], dotted: str) -> tuple[bool, Any]:
    """按 a.b.c 深入嵌套对象；返回 (是否命中路径, 值)。"""
    cursor: Any = row
    for part in str(dotted or "").split("."):
        token = part.strip()
        if not token or not isinstance(cursor, dict):
            return False, None
        lower_map = {str(k).lower(): k for k in cursor.keys()}
        actual = lower_map.get(token.lower())
        if actual is None:
            return False, None
        cursor = cursor.get(actual)
    return True, cursor


def project_row_by_select(row: Any, select_keys: List[str]) -> Any:
    """
    按 select 保留行字段。

    - 平铺名：number、baseunit_number
    - 点号路径：baseunit.number / group.number 从嵌套对象取值，输出为 baseunit_number / group_number
    - 禁止用末段裸名（如 number）冒充 baseunit.number，否则会丢掉分组/单位嵌套列
    """
    if not isinstance(row, dict) or not select_keys:
        return row
    lower_map = {str(k).lower(): k for k in row.keys()}
    projected: Dict[str, Any] = {}
    for key in select_keys:
        raw = str(key or "").strip()
        if not raw:
            continue
        out_col = _select_output_column(raw)
        value: Any = None
        found = False

        for variant in (raw, raw.replace(".", "_")):
            actual = lower_map.get(variant.lower())
            if actual is not None:
                value = row.get(actual)
                found = True
                break

        if not found and "." in raw:
            hit, nested = _dig_nested_path(row, raw)
            if hit:
                value = nested
                found = True

        if found and out_col not in projected:
            projected[out_col] = value
    return projected if projected else row


def collapse_material_rows_to_unique_units(rows: List[Any]) -> List[Dict[str, Any]]:
    """
    物料行 → 按基础单位编码去重。
    单位同步源常是物料 batchQuery；同一 kg 会在每条物料上重复出现。
    """
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = (
            row.get("baseunit_number")
            or row.get("baseunit.number")
            or row.get("measureunitid_number")
            or row.get("measureunitid.number")
        )
        name = (
            row.get("baseunit_name")
            or row.get("baseunit.name")
            or row.get("measureunitid_name")
            or row.get("measureunitid.name")
            or code
        )
        code_s = str(code or "").strip()
        name_s = str(name or "").strip() or code_s
        if not code_s:
            continue
        key = code_s.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "baseunit_number": code_s,
                "baseunit_name": name_s,
                "number": code_s,
                "name": name_s,
                "code": code_s,
            }
        )
    return out


def project_response_by_select(body: Any, select_text: str) -> Any:
    """
    对苍穹查询响应按 select 裁剪行对象字段。
    网关常忽略 select 仍回全量时，测试预览与下游映射只见需要的列。

    注意：此处**禁止**按单位去重。同步分页用「本页行数 < pageSize」判断是否结束；
    若在 test_api 内先把 100 条物料收成 1 个单位，分页会误停，单位只剩一两个。
    去重放在单位同步写入前 / 前端预览展示层。
    """
    keys = [part.strip() for part in str(select_text or "").split(",") if part.strip()]
    if not keys:
        return body

    def project_rows(rows: Any) -> Any:
        if not isinstance(rows, list):
            return rows
        return [
            project_row_by_select(item, keys) if isinstance(item, dict) else item
            for item in rows
        ]

    if isinstance(body, list):
        return project_rows(body)
    if not isinstance(body, dict):
        return body

    out = dict(body)
    for nest_key in ("data", "items", "rows", "records", "result", "list", "Results"):
        nested = out.get(nest_key)
        if isinstance(nested, list) and nested and isinstance(nested[0], dict):
            out[nest_key] = project_rows(nested)
            return out
        if isinstance(nested, dict):
            for inner_key in ("rows", "items", "records", "list", "data"):
                inner = nested.get(inner_key)
                if isinstance(inner, list) and inner and isinstance(inner[0], dict):
                    nested_out = dict(nested)
                    nested_out[inner_key] = project_rows(inner)
                    out[nest_key] = nested_out
                    return out
    return out


def collapse_response_rows_to_unique_units(body: Any) -> Any:
    """仅用于接口测试展示：把物料行收成唯一单位（不参与同步分页）。"""
    def collapse_list(rows: Any) -> Any:
        if not isinstance(rows, list):
            return rows
        collapsed = collapse_material_rows_to_unique_units(rows)
        return collapsed if collapsed else rows

    if isinstance(body, list):
        return collapse_list(body)
    if not isinstance(body, dict):
        return body
    out = dict(body)
    for nest_key in ("data", "items", "rows", "records", "result", "list", "Results"):
        nested = out.get(nest_key)
        if isinstance(nested, list) and nested and isinstance(nested[0], dict):
            out[nest_key] = collapse_list(nested)
            return out
        if isinstance(nested, dict):
            for inner_key in ("rows", "items", "records", "list", "data"):
                inner = nested.get(inner_key)
                if isinstance(inner, list) and inner and isinstance(inner[0], dict):
                    nested_out = dict(nested)
                    nested_out[inner_key] = collapse_list(inner)
                    out[nest_key] = nested_out
                    return out
    return out


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
