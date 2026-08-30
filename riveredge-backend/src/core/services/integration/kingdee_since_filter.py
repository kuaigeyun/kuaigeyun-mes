"""金蝶 ExecuteBillQuery 请求体：按修改时间注入增量 FilterString。"""

from __future__ import annotations

import copy
import json
from datetime import datetime
from typing import Any, Dict, Optional

from core.utils.timezone_utils import to_site_timezone


def _parse_query_from_body(request_body: Dict[str, Any]) -> tuple[Any, Optional[dict]]:
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


def apply_kingdee_since_filter(
    request_body: Optional[Dict[str, Any]],
    since: datetime,
    *,
    date_field: str = "FModifyDate",
) -> Dict[str, Any]:
    """
    深拷贝 kdsvc 请求体，向 FilterString 追加「修改时间 >= since」（站点墙钟）。
    非金蝶信封结构则原样返回拷贝。
    """
    body = copy.deepcopy(request_body) if isinstance(request_body, dict) else {}
    params, query = _parse_query_from_body(body)
    if not isinstance(query, dict):
        return body

    site_since = to_site_timezone(since).strftime("%Y-%m-%d %H:%M:%S")
    clause = f"{date_field}>='{site_since}'"
    existing = str(query.get("FilterString") or query.get("filterString") or "").strip()
    if clause in existing:
        filter_string = existing
    elif existing:
        filter_string = f"({existing}) AND ({clause})"
    else:
        filter_string = clause
    query["FilterString"] = filter_string

    if isinstance(params, list):
        body["parameters"] = [json.dumps(query, ensure_ascii=False), *params[1:]]
    elif isinstance(params, dict):
        body["parameters"] = query
    elif isinstance(params, str):
        body["parameters"] = json.dumps(query, ensure_ascii=False)
    return body
