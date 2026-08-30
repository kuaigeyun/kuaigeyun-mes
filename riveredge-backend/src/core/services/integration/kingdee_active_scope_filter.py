"""金蝶 ExecuteBillQuery：按单据类型注入「有效主数据 / 未完成单据」FilterString。"""

from __future__ import annotations

import copy
import json
import re
from typing import Any, Dict, Optional

from core.services.integration.kingdee_since_filter import _parse_query_from_body

# 主数据：已审核且未禁用
MASTER_DATA_ACTIVE_FILTER = "FForbidStatus='A' AND FDocumentStatus='C'"
MASTER_DATA_ACTIVE_MARKER = "FDocumentStatus='C'"
# 物料分组：常见无「已审核」语义，仅排除禁用（过严会导致拉取 0 条）
MATERIAL_GROUP_ACTIVE_FILTER = "FForbidStatus='A'"
MATERIAL_GROUP_ACTIVE_MARKER = "FForbidStatus='A'"

# 业务单据：已审核且未关闭（未完成）
BILL_OPEN_FILTER = "FDocumentStatus='C' AND FCloseStatus='A'"
BILL_OPEN_MARKER = "FCloseStatus='A'"

# 即时库存：仅有数量
INVENTORY_ACTIVE_FILTER = "FBaseQty<>0"
INVENTORY_ACTIVE_MARKER = "FBaseQty<>0"

_MATERIAL_GROUP_FORM_IDS = frozenset({"BD_MATERIALGROUP"})
_MASTER_FORM_IDS = frozenset(
    {
        "BD_CUSTOMER",
        "BD_SUPPLIER",
        "BD_MATERIAL",
        "BD_UNIT",
        "BD_STOCK",
    }
)
_BILL_FORM_IDS = frozenset(
    {
        "SAL_SALEORDER",
        "PUR_PURCHASEORDER",
        "PRD_MO",
    }
)
_INVENTORY_FORM_IDS = frozenset({"STK_INVENTORY"})

# 关闭「仅有效」时需剥离的已知范围条件（含历史弱过滤）
_SCOPE_CLAUSES_TO_STRIP = (
    MASTER_DATA_ACTIVE_FILTER,
    MATERIAL_GROUP_ACTIVE_FILTER,
    BILL_OPEN_FILTER,
    INVENTORY_ACTIVE_FILTER,
    "FForbidStatus='A'",
    "FDocumentStatus='C'",
    "FCloseStatus='A'",
    "FBaseQty<>0",
)


def resolve_active_scope_filter(form_id: Optional[str]) -> Optional[str]:
    """按 FormId 返回有效/未完成范围过滤；未知类型返回 None。"""
    key = str(form_id or "").strip().upper()
    if not key:
        return None
    if key in _MATERIAL_GROUP_FORM_IDS:
        return MATERIAL_GROUP_ACTIVE_FILTER
    if key in _MASTER_FORM_IDS:
        return MASTER_DATA_ACTIVE_FILTER
    if key in _BILL_FORM_IDS:
        return BILL_OPEN_FILTER
    if key in _INVENTORY_FORM_IDS:
        return INVENTORY_ACTIVE_FILTER
    return None


def _filter_already_covers(existing: str, clause: str) -> bool:
    compact_existing = existing.replace(" ", "")
    compact_clause = clause.replace(" ", "")
    if compact_clause and compact_clause in compact_existing:
        return True
    if clause == MASTER_DATA_ACTIVE_FILTER and MASTER_DATA_ACTIVE_MARKER.replace(" ", "") in compact_existing:
        if "FForbidStatus='A'" in compact_existing or 'FForbidStatus="A"' in compact_existing:
            return True
    if clause == MATERIAL_GROUP_ACTIVE_FILTER and MATERIAL_GROUP_ACTIVE_MARKER.replace(" ", "") in compact_existing:
        return True
    if clause == BILL_OPEN_FILTER and BILL_OPEN_MARKER.replace(" ", "") in compact_existing:
        if MASTER_DATA_ACTIVE_MARKER.replace(" ", "") in compact_existing:
            return True
    if clause == INVENTORY_ACTIVE_FILTER and INVENTORY_ACTIVE_MARKER.replace(" ", "") in compact_existing:
        return True
    return False


def _write_query_back(body: Dict[str, Any], params: Any, query: dict) -> Dict[str, Any]:
    if isinstance(params, list):
        body["parameters"] = [json.dumps(query, ensure_ascii=False), *params[1:]]
    elif isinstance(params, dict):
        body["parameters"] = query
    elif isinstance(params, str):
        body["parameters"] = json.dumps(query, ensure_ascii=False)
    return body


def _strip_known_scope_filters(existing: str) -> str:
    """去掉已知有效/未完成过滤，保留其它自定义条件（如增量时间）。"""
    result = existing
    for clause in _SCOPE_CLAUSES_TO_STRIP:
        # 直接子串（含括号包裹）
        for pattern in (
            rf"\(\s*{re.escape(clause)}\s*\)",
            re.escape(clause),
        ):
            result = re.sub(pattern, "", result, flags=re.IGNORECASE)
    # 清理残留 AND / 空括号
    result = re.sub(r"\(\s*\)", "", result)
    result = re.sub(r"\s+AND\s+AND\s+", " AND ", result, flags=re.IGNORECASE)
    result = re.sub(r"^\s*AND\s+", "", result, flags=re.IGNORECASE)
    result = re.sub(r"\s+AND\s*$", "", result, flags=re.IGNORECASE)
    result = re.sub(r"^\s*AND\s*$", "", result, flags=re.IGNORECASE)
    result = re.sub(r"\s{2,}", " ", result).strip(" ()")
    return result.strip()


def apply_kingdee_active_scope_filter(
    request_body: Optional[Dict[str, Any]],
    *,
    active_only: bool = True,
) -> Dict[str, Any]:
    """
    深拷贝请求体。
    - active_only=True：追加有效主数据 / 未完成单据 FilterString
    - active_only=False：剥离已知范围过滤，便于按需全量拉取
    """
    body = copy.deepcopy(request_body) if isinstance(request_body, dict) else {}
    params, query = _parse_query_from_body(body)
    if not isinstance(query, dict):
        return body

    form_id = query.get("FormId") or query.get("formId") or query.get("FormID")
    form_key = str(form_id or "").strip().upper()
    clause = resolve_active_scope_filter(form_key if form_id is not None else None)
    existing = str(query.get("FilterString") or query.get("filterString") or "").strip()

    if not active_only:
        if not clause and not existing:
            return body
        stripped = _strip_known_scope_filters(existing)
        if stripped == existing:
            return body
        query["FilterString"] = stripped
        return _write_query_back(body, params, query)

    if not clause:
        return body

    # 物料分组：库内旧预置常误带 FDocumentStatus='C'，须强制改写为仅未禁用
    if form_key in _MATERIAL_GROUP_FORM_IDS:
        stripped = _strip_known_scope_filters(existing)
        if stripped:
            filter_string = f"({stripped}) AND ({MATERIAL_GROUP_ACTIVE_FILTER})"
        else:
            filter_string = MATERIAL_GROUP_ACTIVE_FILTER
        if filter_string.replace(" ", "") == existing.replace(" ", ""):
            return body
        query["FilterString"] = filter_string
        return _write_query_back(body, params, query)

    if _filter_already_covers(existing, clause):
        return body

    if existing:
        filter_string = f"({existing}) AND ({clause})"
    else:
        filter_string = clause
    query["FilterString"] = filter_string
    return _write_query_back(body, params, query)
