"""
JSON 对象字段规范：将 JSONField 中误存的 list、标量等转为 dict，供 Pydantic Dict 字段使用。
"""

import json
from typing import Any, Dict


def normalize_json_object_field(v: Any) -> Dict[str, Any]:
    """
    将 Tortoise JSONField / 历史脏数据规范为 dict。
    生产库中常见 []（JSON 数组）而接口约定为 object 的情况。
    """
    if isinstance(v, dict):
        return v
    if v is None:
        return {}
    if isinstance(v, list):
        return {}
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return {}
        try:
            parsed = json.loads(s)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return {}
        except json.JSONDecodeError:
            return {}
    return {}


def normalize_optional_json_object_field(v: Any) -> Any:
    """Optional[Dict] 字段：显式 None 保持 None，否则走 normalize_json_object_field。"""
    if v is None:
        return None
    return normalize_json_object_field(v)
