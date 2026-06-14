"""审核条件字段注册表（按 entity_type）。"""

from __future__ import annotations

from typing import Any, Dict, List

_DEFAULT_FIELDS: Dict[str, List[Dict[str, Any]]] = {
    "sales_order": [
        {"field": "total_amount", "label": "订单总金额", "type": "number", "operators": [">=", ">", "<", "<=", "=="]},
        {"field": "department_id", "label": "部门", "type": "number", "operators": ["==", "!="]},
        {"field": "customer_level", "label": "客户等级", "type": "string", "operators": ["==", "contains"]},
    ],
    "purchase_order": [
        {"field": "total_amount", "label": "采购总金额", "type": "number", "operators": [">=", ">", "<", "<=", "=="]},
        {"field": "supplier_id", "label": "供应商", "type": "number", "operators": ["==", "!="]},
    ],
    "quotation": [
        {"field": "total_amount", "label": "报价总金额", "type": "number", "operators": [">=", ">", "<", "<=", "=="]},
    ],
}


def condition_fields_for_entity(entity_type: str) -> List[Dict[str, Any]]:
    key = (entity_type or "").strip()
    return list(_DEFAULT_FIELDS.get(key, []))


def all_condition_fields() -> Dict[str, List[Dict[str, Any]]]:
    return {k: list(v) for k, v in _DEFAULT_FIELDS.items()}
