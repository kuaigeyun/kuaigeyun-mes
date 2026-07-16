"""字段权限资源 → 可配置字段（唯一真源）。

仅在此注册的业务资源会在角色「字段权限」页展示内置脱敏字段；
未注册资源（如我的消息、偏好设置）不生成任何字段策略。
"""

from __future__ import annotations

from typing import FrozenSet

# 金额类 canonical 字段名（与 PermissionPolicyService.BUILTIN_MASKED_FIELD_NAMES 子集对齐）
_AMOUNT_FIELDS: FrozenSet[str] = frozenset(
    {
        "amount",
        "total_amount",
        "tax_amount",
        "unit_price",
        "price",
        "amount_with_tax",
        "amount_without_tax",
    }
)

_SALES_DOC_FIELDS: FrozenSet[str] = _AMOUNT_FIELDS | frozenset({"customer_name"})

_PURCHASE_DOC_FIELDS: FrozenSet[str] = _AMOUNT_FIELDS

_FINANCE_AR_FIELDS: FrozenSet[str] = _AMOUNT_FIELDS | frozenset({"customer_name"})

_FINANCE_AP_FIELDS: FrozenSet[str] = _AMOUNT_FIELDS

_OUTSOURCE_FIELDS: FrozenSet[str] = frozenset({"unit_price", "total_amount", "amount"})

_INVENTORY_FIELDS: FrozenSet[str] = frozenset({"total_amount", "amount", "unit_price", "price"})

# app:resource（小写）→ 该单据实际存在的可脱敏字段
FIELD_PERMISSION_RESOURCE_FIELDS: dict[str, FrozenSet[str]] = {
    # kuaizhizao - 销售
    "kuaizhizao:quotation": _SALES_DOC_FIELDS,
    "kuaizhizao:sales-contract": _SALES_DOC_FIELDS,
    "kuaizhizao:sales-order": _SALES_DOC_FIELDS,
    "kuaizhizao:sales-order-change": _SALES_DOC_FIELDS,
    "kuaizhizao:demand": _SALES_DOC_FIELDS,
    # kuaizhizao - 采购 / 外协
    "kuaizhizao:purchase-requisition": _PURCHASE_DOC_FIELDS,
    "kuaizhizao:purchase-order": _PURCHASE_DOC_FIELDS,
    "kuaizhizao:purchase-order-change": _PURCHASE_DOC_FIELDS,
    "kuaizhizao:outsource-order": _OUTSOURCE_FIELDS,
    # kuaizhizao - 仓储
    "kuaizhizao:warehouse-management-inventory": _INVENTORY_FIELDS,
    # kuaicaiwu - 应收 / 应付
    "kuaicaiwu:receivable": _FINANCE_AR_FIELDS,
    "kuaicaiwu:sales-invoice": _FINANCE_AR_FIELDS,
    "kuaicaiwu:receipt": _FINANCE_AR_FIELDS,
    "kuaicaiwu:payable": _FINANCE_AP_FIELDS,
    "kuaicaiwu:purchase-invoice": _FINANCE_AP_FIELDS,
    "kuaicaiwu:payment": _FINANCE_AP_FIELDS,
}


def normalize_field_permission_resource(raw: str) -> str:
    return (raw or "").strip().lower()


def field_names_for_resource(resource: str) -> FrozenSet[str]:
    """返回资源可配置的字段集合；未注册资源返回空集。"""
    key = normalize_field_permission_resource(resource)
    return FIELD_PERMISSION_RESOURCE_FIELDS.get(key, frozenset())


def is_valid_field_policy(resource: str, field_name: str) -> bool:
    key = normalize_field_permission_resource(resource)
    fields = FIELD_PERMISSION_RESOURCE_FIELDS.get(key)
    if not fields:
        return False
    return (field_name or "").strip().lower() in fields


def resources_with_field_policies() -> frozenset[str]:
    return frozenset(FIELD_PERMISSION_RESOURCE_FIELDS.keys())
