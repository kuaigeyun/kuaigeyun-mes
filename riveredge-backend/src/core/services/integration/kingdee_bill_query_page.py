"""金蝶 ExecuteBillQuery：按 StartRow/Limit 翻页，避免接口 Limit 截断导致主数据不全。"""

from __future__ import annotations

import copy
import json
from typing import Any, Dict, Optional, Tuple

# 单页上限：过大易超时；过小则翻页次数多。接口配置的 Limit 若更小则以其为准（至少 1）。
DEFAULT_PAGE_SIZE = 2000
MAX_PAGES = 500  # 防止异常死循环；2000×500=100 万行上限


def parse_kingdee_query(request_body: Optional[Dict[str, Any]]) -> Tuple[Any, Optional[dict]]:
    """与 since 过滤同一套 parameters 解析。"""
    if not isinstance(request_body, dict):
        return None, None
    params = request_body.get("parameters")
    if isinstance(params, list) and params:
        first = params[0]
        if isinstance(first, str):
            try:
                query = json.loads(first)
            except json.JSONDecodeError:
                return params, None
            return params, query if isinstance(query, dict) else None
        if isinstance(first, dict):
            return params, first
    if isinstance(params, dict):
        return params, params
    if isinstance(params, str):
        try:
            query = json.loads(params)
        except json.JSONDecodeError:
            return params, None
        return params, query if isinstance(query, dict) else None
    return params, None


def is_kingdee_execute_bill_query(request_body: Optional[Dict[str, Any]]) -> bool:
    _, query = parse_kingdee_query(request_body)
    if not isinstance(query, dict):
        return False
    form_id = query.get("FormId") or query.get("formId")
    field_keys = query.get("FieldKeys") or query.get("fieldKeys")
    return bool(form_id and field_keys)


def resolve_page_size(query: dict) -> int:
    raw = query.get("Limit", query.get("limit"))
    try:
        configured = int(raw) if raw is not None else DEFAULT_PAGE_SIZE
    except (TypeError, ValueError):
        configured = DEFAULT_PAGE_SIZE
    if configured <= 0:
        return DEFAULT_PAGE_SIZE
    return min(configured, DEFAULT_PAGE_SIZE)


def with_bill_query_page(
    request_body: Dict[str, Any],
    *,
    start_row: int,
    limit: int,
) -> Dict[str, Any]:
    """深拷贝请求体并写入本页 StartRow/Limit（兼容 StartRow 命名）。"""
    body = copy.deepcopy(request_body)
    params, query = parse_kingdee_query(body)
    if not isinstance(query, dict):
        return body
    query["StartRow"] = int(start_row)
    query["Limit"] = int(limit)

    if isinstance(params, list):
        body["parameters"] = [json.dumps(query, ensure_ascii=False), *params[1:]]
    elif isinstance(params, dict):
        body["parameters"] = query
    elif isinstance(params, str):
        body["parameters"] = json.dumps(query, ensure_ascii=False)
    return body
