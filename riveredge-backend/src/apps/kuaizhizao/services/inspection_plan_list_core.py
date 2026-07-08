"""质检方案列表：排序白名单、keyword、日期区间。"""

from __future__ import annotations

from typing import Optional

from apps.kuaizhizao.services.equipment_list_core import (
    apply_equipment_created_date_range,
    apply_equipment_keyword_filter,
    apply_equipment_updated_date_range,
    resolve_equipment_list_order_by,
)

INSPECTION_PLAN_SORTABLE_FIELDS = frozenset({
    "plan_code",
    "plan_name",
    "plan_type",
    "version",
    "is_active",
    "created_at",
    "updated_at",
})

INSPECTION_PLAN_KEYWORD_FIELDS = ["plan_code", "plan_name"]

DEFAULT_INSPECTION_PLAN_ORDER = "-updated_at"


def apply_inspection_plan_search_filters(
    query,
    *,
    keyword: Optional[str] = None,
    plan_code: Optional[str] = None,
    plan_name: Optional[str] = None,
):
    kw = (keyword or "").strip()
    if kw:
        return apply_equipment_keyword_filter(query, kw, INSPECTION_PLAN_KEYWORD_FIELDS)
    if plan_code and str(plan_code).strip():
        query = query.filter(plan_code__icontains=str(plan_code).strip())
    if plan_name and str(plan_name).strip():
        query = query.filter(plan_name__icontains=str(plan_name).strip())
    return query


def resolve_inspection_plan_list_order_by(order_by: Optional[str]) -> tuple[str, str]:
    primary = resolve_equipment_list_order_by(
        order_by,
        INSPECTION_PLAN_SORTABLE_FIELDS,
        DEFAULT_INSPECTION_PLAN_ORDER,
    )
    descending = primary.startswith("-")
    secondary = "-id" if descending else "id"
    return primary, secondary


def apply_inspection_plan_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    plan_code: Optional[str] = None,
    plan_name: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    order_by: Optional[str] = None,
) -> tuple:
    query = apply_inspection_plan_search_filters(
        query,
        keyword=keyword,
        plan_code=plan_code,
        plan_name=plan_name,
    )
    query = apply_equipment_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_equipment_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    primary_order, secondary_order = resolve_inspection_plan_list_order_by(order_by)
    return query, primary_order, secondary_order
