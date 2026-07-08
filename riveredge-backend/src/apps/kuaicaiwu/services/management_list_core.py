"""管理分析报表列表：keyword、排序、分页（聚合结果内存筛选）。"""

from __future__ import annotations

from typing import List, Optional, Tuple

MARGIN_PRODUCT_SORT_FIELDS = frozenset({
    "product_code",
    "product_name",
    "revenue",
    "cost",
    "gross_margin",
    "gross_margin_rate",
})

MARGIN_CUSTOMER_SORT_FIELDS = frozenset({
    "customer_name",
    "revenue",
    "cost",
    "gross_margin",
    "gross_margin_rate",
})

MARGIN_ORDER_SORT_FIELDS = frozenset({
    "sales_order_code",
    "delivery_code",
    "revenue",
    "cost",
    "gross_margin",
    "gross_margin_rate",
})

_MARGIN_SORT_BY_GROUP = {
    "product": MARGIN_PRODUCT_SORT_FIELDS,
    "customer": MARGIN_CUSTOMER_SORT_FIELDS,
    "order": MARGIN_ORDER_SORT_FIELDS,
}

_MARGIN_KEYWORD_FIELDS_BY_GROUP = {
    "product": ("product_code", "product_name", "revenue", "cost", "gross_margin", "gross_margin_rate"),
    "customer": ("customer_name", "revenue", "cost", "gross_margin", "gross_margin_rate"),
    "order": ("sales_order_code", "delivery_code", "revenue", "cost", "gross_margin", "gross_margin_rate"),
}


def filter_sort_paginate_margin_report_items(
    items: List[dict],
    *,
    group_by: str,
    keyword: Optional[str] = None,
    product_code: Optional[str] = None,
    product_name: Optional[str] = None,
    customer_name: Optional[str] = None,
    sales_order_code: Optional[str] = None,
    delivery_code: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[dict], int]:
    filtered = list(items)
    group = (group_by or "product").strip().lower()
    kw = (keyword or "").strip().lower()

    if kw:
        fields = _MARGIN_KEYWORD_FIELDS_BY_GROUP.get(group, _MARGIN_KEYWORD_FIELDS_BY_GROUP["product"])
        filtered = [
            row
            for row in filtered
            if kw in "\n".join(str(row.get(field) or "") for field in fields).lower()
        ]
    else:
        if product_code and str(product_code).strip():
            code_kw = str(product_code).strip().lower()
            filtered = [
                row for row in filtered if code_kw in str(row.get("product_code") or "").lower()
            ]
        if product_name and str(product_name).strip():
            name_kw = str(product_name).strip().lower()
            filtered = [
                row for row in filtered if name_kw in str(row.get("product_name") or "").lower()
            ]
        if customer_name and str(customer_name).strip():
            name_kw = str(customer_name).strip().lower()
            filtered = [
                row for row in filtered if name_kw in str(row.get("customer_name") or "").lower()
            ]
        if sales_order_code and str(sales_order_code).strip():
            code_kw = str(sales_order_code).strip().lower()
            filtered = [
                row for row in filtered if code_kw in str(row.get("sales_order_code") or "").lower()
            ]
        if delivery_code and str(delivery_code).strip():
            code_kw = str(delivery_code).strip().lower()
            filtered = [
                row for row in filtered if code_kw in str(row.get("delivery_code") or "").lower()
            ]

    allowed = _MARGIN_SORT_BY_GROUP.get(group, MARGIN_PRODUCT_SORT_FIELDS)
    key = (sort_field or "gross_margin").strip()
    if key not in allowed:
        key = "gross_margin"
    reverse = (sort_order or "desc").lower() == "desc"

    def _sort_value(row: dict):
        val = row.get(key)
        if isinstance(val, (int, float)):
            return val
        return str(val or "")

    filtered.sort(key=_sort_value, reverse=reverse)
    total = len(filtered)
    start = max(skip, 0)
    end = start + max(limit, 1)
    return filtered[start:end], total
