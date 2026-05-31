"""模具保养项取值类型与记录值规范化（text / multiselect）。"""

from __future__ import annotations

import json
from typing import Optional


def normalize_upkeep_value_type(raw: Optional[str]) -> str:
    v = (raw or "text").strip().lower()
    if v in ("multiselect", "multi_select", "multi", "多选"):
        return "multiselect"
    if v in ("text", "文本"):
        return "text"
    return "text"


def parse_multiselect_options(raw: Optional[str]) -> list[str]:
    if raw is None:
        return []
    s = str(raw).strip()
    if not s:
        return []
    if s.startswith("["):
        try:
            arr = json.loads(s)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()]
        except json.JSONDecodeError:
            pass
    return [p.strip() for p in s.replace("，", ",").split(",") if p.strip()]


def normalize_multiselect_options(raw: Optional[str]) -> Optional[str]:
    """保养项多选候选项：逗号分隔存储，空表示未配置。"""
    parts = parse_multiselect_options(raw)
    if not parts:
        return None
    joined = ",".join(parts)
    if len(joined) > 2000:
        raise ValueError("多选候选项过长（最多 2000 字符）")
    return joined


def option_values_for_param(value_type: str, default_value: Optional[str]) -> list[str]:
    if normalize_upkeep_value_type(value_type) != "multiselect":
        return []
    return parse_multiselect_options(default_value)


def normalize_upkeep_record_value(
    value_type: str,
    raw: Optional[str],
    *,
    option_values: Optional[list[str]] = None,
) -> Optional[str]:
    """校验并规范化完修单保养记录值。"""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    vt = normalize_upkeep_value_type(value_type)
    if vt == "multiselect":
        if s.startswith("["):
            try:
                arr = json.loads(s)
                if isinstance(arr, list):
                    parts = [str(x).strip() for x in arr if str(x).strip()]
                else:
                    parts = []
            except json.JSONDecodeError:
                parts = [p.strip() for p in s.replace("，", ",").split(",") if p.strip()]
        else:
            parts = [p.strip() for p in s.replace("，", ",").split(",") if p.strip()]
        if not parts:
            return None
        allowed = set(option_values or [])
        if allowed:
            bad = [p for p in parts if p not in allowed]
            if bad:
                raise ValueError(f"多选记录含未定义选项：{', '.join(bad)}")
        joined = ",".join(parts)
        if len(joined) > 2000:
            raise ValueError("多选保养记录过长（最多 2000 字符）")
        return joined
    if len(s) > 2000:
        raise ValueError("文本保养记录过长（最多 2000 字符）")
    return s
