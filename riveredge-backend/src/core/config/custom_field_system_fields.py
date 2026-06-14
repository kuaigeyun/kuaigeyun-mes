"""
自定义字段源字段（系统字段）规范

为关联对象 VLOOKUP 提供当前表系统字段列表，供管理端配置源字段。
"""

from __future__ import annotations

from typing import Any, Dict, List

from tortoise import fields as tortoise_fields
from tortoise.fields.relational import ForeignKeyFieldInstance

from core.config.associated_table_registry import _get_model

_EXCLUDED_SYSTEM_FIELD_NAMES = frozenset({
    "id",
    "uuid",
    "tenant_id",
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
    "updated_by",
})

_ALLOWED_FIELD_CLASSES = (
    tortoise_fields.CharField,
    tortoise_fields.TextField,
    tortoise_fields.IntField,
    tortoise_fields.BigIntField,
    tortoise_fields.SmallIntField,
    tortoise_fields.FloatField,
    tortoise_fields.DecimalField,
    tortoise_fields.BooleanField,
    tortoise_fields.DateField,
    tortoise_fields.DatetimeField,
    tortoise_fields.TimeField,
)

# 表单字段名与模型字段名不一致时的映射（table_name -> { form_name: model_name }）
_FORM_FIELD_ALIASES: Dict[str, Dict[str, str]] = {
    "master_data_sops": {
        "operationId": "operation_id",
        "isActive": "is_active",
    },
    "master_data_factory_plants": {
        "isActive": "is_active",
    },
    "master_data_factory_workshops": {
        "isActive": "is_active",
        "plantId": "plant_id",
    },
}


def _to_camel_case(name: str) -> str:
    parts = name.split("_")
    if len(parts) <= 1:
        return name
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def get_system_source_fields(table_name: str) -> List[Dict[str, Any]]:
    """返回指定表可用于 VLOOKUP 源字段的系统字段列表。"""
    model = _get_model(table_name)
    if model is None:
        return []

    aliases = _FORM_FIELD_ALIASES.get(table_name, {})
    reverse_aliases = {model_name: form_name for form_name, model_name in aliases.items()}
    items: List[Dict[str, Any]] = []
    seen_form_names: set[str] = set()

    for field_name, field in model._meta.fields_map.items():
        if field_name in _EXCLUDED_SYSTEM_FIELD_NAMES:
            continue
        if field_name.endswith("_id") and field_name != "id":
            continue
        if not isinstance(field, _ALLOWED_FIELD_CLASSES):
            continue

        label = (getattr(field, "description", None) or field_name).strip()
        form_name = reverse_aliases.get(field_name, _to_camel_case(field_name))
        if form_name in seen_form_names:
            continue
        seen_form_names.add(form_name)
        items.append({
            "name": form_name,
            "modelField": field_name,
            "label": label,
            "scope": "system",
        })

    items.sort(key=lambda item: item["name"])
    return items


def get_system_link_fields(table_name: str) -> List[Dict[str, Any]]:
    """返回指定表可用于关联属性「关联对象字段」的系统字段（外键 ID 列）。"""
    model = _get_model(table_name)
    if model is None:
        return []

    aliases = _FORM_FIELD_ALIASES.get(table_name, {})
    reverse_aliases = {model_name: form_name for form_name, model_name in aliases.items()}
    items: List[Dict[str, Any]] = []
    seen_form_names: set[str] = set()

    def append_link_field(model_field: str, form_name: str, label: str) -> None:
        if form_name in seen_form_names:
            return
        seen_form_names.add(form_name)
        items.append({
            "name": form_name,
            "modelField": model_field,
            "label": label,
            "scope": "system",
        })

    for field_name, field in model._meta.fields_map.items():
        if field_name in _EXCLUDED_SYSTEM_FIELD_NAMES or field_name == "id":
            continue

        if isinstance(field, ForeignKeyFieldInstance):
            model_field = f"{field_name}_id"
            label = (getattr(field, "description", None) or field_name).strip()
            form_name = reverse_aliases.get(
                model_field,
                f"{_to_camel_case(field_name)}Id",
            )
            append_link_field(model_field, form_name, label)
            continue

        if not field_name.endswith("_id"):
            continue
        if not isinstance(
            field,
            (tortoise_fields.IntField, tortoise_fields.BigIntField, tortoise_fields.SmallIntField),
        ):
            continue

        label = (getattr(field, "description", None) or field_name).strip()
        form_name = reverse_aliases.get(field_name, _to_camel_case(field_name))
        append_link_field(field_name, form_name, label)

    items.sort(key=lambda item: item["name"])
    return items


def get_associated_table_model_fields(table_name: str) -> List[Dict[str, Any]]:
    """返回关联表模型字段，供匹配字段 / 返回字段 / 属性字段配置（值为 model 列名）。"""
    model = _get_model(table_name)
    if model is None:
        return []

    items: List[Dict[str, Any]] = []
    seen_fields: set[str] = set()

    def append_field(field_name: str, label: str) -> None:
        if field_name in seen_fields:
            return
        seen_fields.add(field_name)
        items.append({
            "field": field_name,
            "label": label,
        })

    id_field = model._meta.fields_map.get("id")
    if id_field is not None:
        append_field("id", (getattr(id_field, "description", None) or "ID").strip())

    for field_name, field in model._meta.fields_map.items():
        if field_name in _EXCLUDED_SYSTEM_FIELD_NAMES or field_name == "id":
            continue
        if isinstance(field, ForeignKeyFieldInstance):
            fk_id_field = f"{field_name}_id"
            label = (getattr(field, "description", None) or field_name).strip()
            append_field(fk_id_field, f"{label} ID")
            continue
        if field_name.endswith("_id"):
            continue
        if not isinstance(field, _ALLOWED_FIELD_CLASSES):
            continue
        label = (getattr(field, "description", None) or field_name).strip()
        append_field(field_name, label)

    items.sort(key=lambda item: item["field"])
    return items


def is_valid_model_field(table_name: str, field_name: str) -> bool:
    model = _get_model(table_name)
    if not model:
        return False
    name = (field_name or "").strip()
    if not name:
        return False
    if name in model._meta.fields_map:
        return True
    if name.endswith("_id"):
        base = name[:-3]
        return base in model._meta.fields_map
    return False
