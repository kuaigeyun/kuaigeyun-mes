"""审核中可编辑字段注册表（按 entity_type）。"""

from __future__ import annotations

from typing import Dict, List, Optional, Union

EditableFieldsSpec = Union[List[str], str]

_DEFAULT_EDITABLE: Dict[str, EditableFieldsSpec] = {
    "sales_order": [
        "delivery_date",
        "customer_contact",
        "customer_phone",
        "total_amount",
        "discount_amount",
        "salesman_name",
        "shipping_address",
        "shipping_method",
        "payment_terms",
        "notes",
        "items",
    ],
    "purchase_order": [
        "delivery_date",
        "total_amount",
        "notes",
        "items",
    ],
    "quotation": [
        "notes",
        "items",
        "total_amount",
        "total_quantity",
        "delivery_date",
        "discount_amount",
    ],
    "demand": [
        "priority",
        "notes",
        "delivery_date",
        "demand_date",
        "items",
    ],
    "sales_contract": [
        "notes",
        "items",
        "milestones",
        "customer_contact",
        "customer_phone",
        "shipping_address",
        "shipping_method",
        "payment_terms",
        "valid_from",
        "valid_to",
        "attachments",
        "discount_amount",
    ],
    "purchase_request": [
        "notes",
        "items",
        "required_date",
        "requisition_name",
        "requisition_date",
        "attachments",
    ],
    "sales_forecast": [
        "notes",
        "items",
        "forecast_name",
        "start_date",
        "end_date",
        "attachments",
    ],
    "sales_order_change": [
        "change_reason",
        "items",
        "effective_date",
        "header_changes",
        "notes",
        "attachments",
        "change_category",
    ],
    "purchase_order_change": [
        "change_reason",
        "items",
        "effective_date",
        "header_changes",
        "notes",
        "attachments",
        "change_category",
    ],
    "purchase_inquiry": [
        "notes",
        "items",
        "vendors",
        "inquiry_name",
        "inquiry_date",
        "quote_deadline",
    ],
}

_LOCKED_FIELDS = frozenset({"status", "review_status", "id", "uuid", "tenant_id"})


def editable_fields_for_entity(entity_type: str) -> EditableFieldsSpec:
    key = (entity_type or "").strip()
    return _DEFAULT_EDITABLE.get(key, [])


def is_field_editable(
    entity_type: str,
    field: str,
    node_editable: Optional[List[str]] = None,
) -> bool:
    if field in _LOCKED_FIELDS:
        return False
    if node_editable:
        if node_editable == "*" or (isinstance(node_editable, list) and "*" in node_editable):
            return field not in _LOCKED_FIELDS
        return field in node_editable
    spec = editable_fields_for_entity(entity_type)
    if spec == "*":
        return field not in _LOCKED_FIELDS
    if isinstance(spec, list):
        return field in spec
    return False
