"""系统级可引用资源（非 manifest 应用）。"""

from __future__ import annotations

from typing import Any, TypedDict


class ReferenceResourceSpec(TypedDict, total=False):
    permission_prefix: str
    display_fields: list[str]
    data_scope_key: str | None
    sensitive: bool


CORE_REFERENCE_RESOURCES: dict[str, ReferenceResourceSpec] = {
    "system:user": {
        "permission_prefix": "system:user",
        "display_fields": ["id", "uuid", "username", "full_name", "label"],
        "data_scope_key": None,
        "sensitive": False,
    },
    "system:department": {
        "permission_prefix": "system:department",
        "display_fields": ["id", "uuid", "code", "name", "label"],
        "data_scope_key": None,
        "sensitive": False,
    },
    "system:position": {
        "permission_prefix": "system:position",
        "display_fields": ["id", "uuid", "code", "name", "label"],
        "data_scope_key": None,
        "sensitive": False,
    },
    "system:file": {
        "permission_prefix": "system:file",
        "display_fields": ["id", "uuid", "name", "label"],
        "data_scope_key": None,
        "sensitive": False,
    },
    "system:data-dictionary": {
        "permission_prefix": "system:data-dictionary",
        "display_fields": ["id", "code", "name", "label"],
        "data_scope_key": None,
        "sensitive": False,
    },
}


# 系统宿主模块 → 引用资源（无 manifest 的核心模块）
CORE_MODULE_REFERENCES: dict[str, list[str]] = {
    "user": [
        "master-data:supply-chain:customer",
        "master-data:supply-chain:supplier",
        "system:department",
        "system:position",
    ],
}

def normalize_reference_resource_spec(raw: Any, *, app_code: str, local_key: str) -> ReferenceResourceSpec | None:
    if not isinstance(raw, dict):
        return None
    prefix = str(raw.get("permission_prefix") or f"{app_code}:{local_key}").strip().lower()
    if not prefix:
        return None
    fields = raw.get("display_fields")
    if not isinstance(fields, list) or not fields:
        fields = ["id", "uuid", "code", "name", "label"]
    scope_key = raw.get("data_scope_key")
    if scope_key is not None:
        scope_key = str(scope_key).strip().lower() or None
    else:
        scope_key = prefix
    return {
        "permission_prefix": prefix,
        "display_fields": [str(f).strip() for f in fields if str(f).strip()],
        "data_scope_key": scope_key,
        "sensitive": bool(raw.get("sensitive", False)),
    }
