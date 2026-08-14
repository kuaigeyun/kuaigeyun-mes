"""轻管理会计成本列表：keyword、日期区间、排序。"""

from __future__ import annotations

from datetime import date
from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.master_data.services.master_data_list_core import (
    apply_master_crud_created_date_range,
    apply_master_crud_updated_date_range,
)

COST_CALCULATION_KEYWORD_FIELDS = (
    "calculation_no",
    "work_order_code",
    "product_code",
    "product_name",
)

COST_CALCULATION_SORT_DB_COLS = frozenset({
    "calculation_no",
    "calculation_type",
    "work_order_code",
    "product_code",
    "product_name",
    "quantity",
    "material_cost",
    "labor_cost",
    "manufacturing_cost",
    "total_cost",
    "unit_cost",
    "calculation_date",
    "calculation_status",
    "created_at",
    "updated_at",
})

COST_RULE_KEYWORD_FIELDS = ("code", "name")

COST_RULE_SORT_DB_COLS = frozenset({
    "code",
    "name",
    "rule_type",
    "cost_type",
    "calculation_method",
    "allocation_basis",
    "source_module",
    "is_active",
    "created_at",
    "updated_at",
})

STANDARD_COST_KEYWORD_FIELDS = ("target_code", "target_name", "description")

STANDARD_COST_SORT_DB_COLS = frozenset({
    "target_type",
    "target_code",
    "target_name",
    "cost_item_type",
    "standard_value",
    "version",
    "effective_date",
    "expiry_date",
    "is_active",
    "created_at",
    "updated_at",
})


def _apply_doc_date_range(query, field: str, *, start_date: Optional[str], end_date: Optional[str]):
    if start_date:
        try:
            start = date.fromisoformat(str(start_date).strip()[:10])
            query = query.filter(**{f"{field}__gte": start})
        except ValueError:
            pass
    if end_date:
        try:
            end = date.fromisoformat(str(end_date).strip()[:10])
            query = query.filter(**{f"{field}__lte": end})
        except ValueError:
            pass
    return query


def _resolve_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    allowed: frozenset,
    default_col: str,
) -> str:
    key = (sort_field or "").strip()
    col = key if key in allowed else default_col
    if (sort_order or "desc").lower() == "desc":
        return f"-{col}"
    return col


def apply_cost_calculation_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    calculation_no: Optional[str] = None,
    work_order_code: Optional[str] = None,
    product_code: Optional[str] = None,
    product_name: Optional[str] = None,
    calculation_type: Optional[str] = None,
    calculation_status: Optional[str] = None,
    work_order_id: Optional[int] = None,
    product_id: Optional[int] = None,
    calculation_date_start: Optional[str] = None,
    calculation_date_end: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    kw = (keyword or "").strip()
    if kw:
        cond = Q()
        for field in COST_CALCULATION_KEYWORD_FIELDS:
            cond |= Q(**{f"{field}__icontains": kw})
        query = query.filter(cond)
    else:
        if calculation_no and str(calculation_no).strip():
            query = query.filter(calculation_no__icontains=str(calculation_no).strip())
        if work_order_code and str(work_order_code).strip():
            query = query.filter(work_order_code__icontains=str(work_order_code).strip())
        if product_code and str(product_code).strip():
            query = query.filter(product_code__icontains=str(product_code).strip())
        if product_name and str(product_name).strip():
            query = query.filter(product_name__icontains=str(product_name).strip())
    if calculation_type and str(calculation_type).strip():
        query = query.filter(calculation_type=str(calculation_type).strip())
    if calculation_status and str(calculation_status).strip():
        query = query.filter(calculation_status=str(calculation_status).strip())
    if work_order_id is not None:
        query = query.filter(work_order_id=work_order_id)
    if product_id is not None:
        query = query.filter(product_id=product_id)
    query = _apply_doc_date_range(
        query,
        "calculation_date",
        start_date=calculation_date_start,
        end_date=calculation_date_end,
    )
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = _resolve_order_clause(
        sort_field,
        sort_order,
        allowed=COST_CALCULATION_SORT_DB_COLS,
        default_col=default_sort_col,
    )
    return query, order_expr


def apply_cost_rule_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    code: Optional[str] = None,
    name: Optional[str] = None,
    rule_type: Optional[str] = None,
    cost_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "created_at",
) -> Tuple:
    kw = (keyword or "").strip()
    if kw:
        cond = Q()
        for field in COST_RULE_KEYWORD_FIELDS:
            cond |= Q(**{f"{field}__icontains": kw})
        query = query.filter(cond)
    else:
        if code and str(code).strip():
            query = query.filter(code__icontains=str(code).strip())
        if name and str(name).strip():
            query = query.filter(name__icontains=str(name).strip())
    if rule_type and str(rule_type).strip():
        query = query.filter(rule_type=str(rule_type).strip())
    if cost_type and str(cost_type).strip():
        query = query.filter(cost_type=str(cost_type).strip())
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = _resolve_order_clause(
        sort_field,
        sort_order,
        allowed=COST_RULE_SORT_DB_COLS,
        default_col=default_sort_col,
    )
    return query, order_expr


def apply_standard_cost_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    target_code: Optional[str] = None,
    target_name: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    cost_item_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    effective_date_start: Optional[str] = None,
    effective_date_end: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "effective_date",
) -> Tuple:
    kw = (keyword or "").strip()
    if kw:
        cond = Q()
        for field in STANDARD_COST_KEYWORD_FIELDS:
            cond |= Q(**{f"{field}__icontains": kw})
        query = query.filter(cond)
    else:
        if target_code and str(target_code).strip():
            query = query.filter(target_code__icontains=str(target_code).strip())
        if target_name and str(target_name).strip():
            query = query.filter(target_name__icontains=str(target_name).strip())
    if target_type and str(target_type).strip():
        query = query.filter(target_type=str(target_type).strip())
    if target_id is not None:
        query = query.filter(target_id=target_id)
    if cost_item_type and str(cost_item_type).strip():
        query = query.filter(cost_item_type=str(cost_item_type).strip())
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = _apply_doc_date_range(
        query,
        "effective_date",
        start_date=effective_date_start,
        end_date=effective_date_end,
    )
    query = apply_master_crud_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_master_crud_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = _resolve_order_clause(
        sort_field,
        sort_order,
        allowed=STANDARD_COST_SORT_DB_COLS,
        default_col=default_sort_col,
    )
    return query, order_expr
