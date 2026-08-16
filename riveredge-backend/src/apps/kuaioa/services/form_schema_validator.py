"""轻办公自定义审批申请字段 schema 校验。"""

from __future__ import annotations

from typing import Any

from infra.exceptions.exceptions import BusinessLogicError


def normalize_fields_schema(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    allowed_types = {
        "text",
        "textarea",
        "number",
        "date",
        "datetime",
        "switch",
        "select",
        "user",
        "department",
        "file",
    }
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        label = str(item.get("label") or "").strip()
        field_type = str(item.get("type") or "text").strip()
        if not name or not label or field_type not in allowed_types:
            continue
        if name in seen:
            continue
        seen.add(name)
        normalized: dict[str, Any] = {
            "name": name,
            "label": label,
            "type": field_type,
            "required": bool(item.get("required")),
        }
        span = item.get("span")
        if span in (12, 24):
            normalized["span"] = span
        elif span in ("12", "24"):
            normalized["span"] = int(span)
        if field_type == "select" and isinstance(item.get("options"), list):
            options = []
            for opt in item["options"]:
                if not isinstance(opt, dict):
                    continue
                value = str(opt.get("value") or "").strip()
                opt_label = str(opt.get("label") or value).strip()
                if value:
                    options.append({"label": opt_label, "value": value})
            normalized["options"] = options
        result.append(normalized)
    return result


def validate_form_data(fields_schema: list[dict[str, Any]], form_data: dict[str, Any] | None) -> None:
    data = form_data or {}
    for field in normalize_fields_schema(fields_schema):
        name = field["name"]
        label = field.get("label") or name
        if not field.get("required"):
            continue
        value = data.get(name)
        if field.get("type") == "switch":
            continue
        if field.get("type") == "user":
            user_id = value.get("id") if isinstance(value, dict) else None
            if user_id in (None, "", 0):
                raise BusinessLogicError(f"字段「{label}」必填")
            continue
        if field.get("type") == "file":
            if not str(value or "").strip():
                raise BusinessLogicError(f"字段「{label}」必填")
            continue
        if value is None or value == "":
            raise BusinessLogicError(f"字段「{label}」必填")
