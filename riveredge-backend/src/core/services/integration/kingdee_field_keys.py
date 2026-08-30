"""从金蝶 kdsvc ExecuteBillQuery 请求体解析 FieldKeys 列名。"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional


def extract_kingdee_field_keys(request_body: Optional[Dict[str, Any]]) -> Optional[List[str]]:
    if not isinstance(request_body, dict):
        return None
    params = request_body.get("parameters")
    query: Any = None
    if isinstance(params, list) and params:
        first = params[0]
        if isinstance(first, str):
            try:
                query = json.loads(first)
            except json.JSONDecodeError:
                return None
        elif isinstance(first, dict):
            query = first
    elif isinstance(params, dict):
        query = params
    elif isinstance(params, str):
        try:
            query = json.loads(params)
        except json.JSONDecodeError:
            return None
    if not isinstance(query, dict):
        return None
    field_keys = query.get("FieldKeys") or query.get("fieldKeys")
    if not field_keys:
        return None
    return [part.strip() for part in str(field_keys).split(",") if part.strip()]
