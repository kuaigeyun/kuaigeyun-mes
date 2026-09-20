"""单据推送：按点分路径写入 Model（支持 list 下标）。"""

from __future__ import annotations

from typing import Any, Callable, Dict, Mapping


def set_path(target: Dict[str, Any], dotted_path: str, value: Any) -> None:
    """按点分路径写入；支持 `FTreeEntity.0.FUnitId.FNumber`。

    中间节点类型不符时重建为 dict/list，与工单推送 `_set_path` 行为对齐。
    """
    keys = [part for part in str(dotted_path or "").split(".") if part]
    if not keys:
        return
    cursor: Any = target
    for index, raw_key in enumerate(keys[:-1]):
        if isinstance(cursor, list):
            idx = int(raw_key)
            while len(cursor) <= idx:
                cursor.append({})
            if not isinstance(cursor[idx], dict):
                cursor[idx] = {}
            cursor = cursor[idx]
            continue
        next_key = keys[index + 1]
        want_list = next_key.isdigit()
        current = cursor.get(raw_key) if isinstance(cursor, dict) else None
        if want_list:
            if not isinstance(current, list):
                cursor[raw_key] = []
        elif not isinstance(current, dict):
            cursor[raw_key] = {}
        cursor = cursor[raw_key]
    last = keys[-1]
    if isinstance(cursor, list):
        idx = int(last)
        while len(cursor) <= idx:
            cursor.append(None)
        cursor[idx] = value
    else:
        cursor[last] = value


def apply_field_map(
    model: Dict[str, Any],
    field_map: Mapping[Any, Any],
    resolve_value: Callable[[str], Any],
) -> None:
    """遍历 field_map：resolve_value(local_key) 非空则 set_path。"""
    for local_key, target_path in field_map.items():
        value = resolve_value(str(local_key))
        if value is not None and value != "":
            set_path(model, str(target_path), value)
