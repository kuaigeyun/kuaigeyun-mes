"""客户池列表：排序白名单、keyword、日期区间。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from tortoise.expressions import Q

from apps.kuaizhizao.services.equipment_list_core import (
    apply_equipment_created_date_range,
    apply_equipment_keyword_filter,
    apply_equipment_updated_date_range,
    resolve_equipment_list_order_by,
)

CUSTOMER_POOL_SORTABLE_FIELDS = frozenset({
    "code",
    "name",
    "contact_person",
    "phone",
    "salesman_name",
    "pool_status",
    "last_follow_up_at",
    "recycle_at",
    "assigned_at",
    "created_at",
    "updated_at",
})

CUSTOMER_POOL_KEYWORD_FIELDS = ["code", "name", "short_name", "contact_person", "phone"]

DEFAULT_CUSTOMER_POOL_ORDER = "-code"


def apply_customer_pool_search_filters(
    query,
    *,
    keyword: Optional[str] = None,
    code: Optional[str] = None,
    name: Optional[str] = None,
    contact_person: Optional[str] = None,
    phone: Optional[str] = None,
):
    kw = (keyword or "").strip()
    if kw:
        return apply_equipment_keyword_filter(query, kw, CUSTOMER_POOL_KEYWORD_FIELDS)
    if code and str(code).strip():
        query = query.filter(code__icontains=str(code).strip())
    if name and str(name).strip():
        query = query.filter(name__icontains=str(name).strip())
    if contact_person and str(contact_person).strip():
        query = query.filter(contact_person__icontains=str(contact_person).strip())
    if phone and str(phone).strip():
        query = query.filter(phone__icontains=str(phone).strip())
    return query


def apply_customer_pool_datetime_range(
    query,
    *,
    field: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    if start is not None:
        query = query.filter(**{f"{field}__gte": start})
    if end is not None:
        query = query.filter(**{f"{field}__lte": end})
    return query


def resolve_customer_pool_list_order_by(order_by: Optional[str]) -> tuple[str, str]:
    primary = resolve_equipment_list_order_by(
        order_by,
        CUSTOMER_POOL_SORTABLE_FIELDS,
        DEFAULT_CUSTOMER_POOL_ORDER,
    )
    descending = primary.startswith("-")
    secondary = "-id" if descending else "id"
    return primary, secondary


def apply_customer_pool_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    code: Optional[str] = None,
    name: Optional[str] = None,
    contact_person: Optional[str] = None,
    phone: Optional[str] = None,
    last_follow_up_from: Optional[datetime] = None,
    last_follow_up_to: Optional[datetime] = None,
    recycle_from: Optional[datetime] = None,
    recycle_to: Optional[datetime] = None,
    assigned_from: Optional[datetime] = None,
    assigned_to: Optional[datetime] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    order_by: Optional[str] = None,
) -> tuple:
    query = apply_customer_pool_search_filters(
        query,
        keyword=keyword,
        code=code,
        name=name,
        contact_person=contact_person,
        phone=phone,
    )
    query = apply_customer_pool_datetime_range(
        query,
        field="last_follow_up_at",
        start=last_follow_up_from,
        end=last_follow_up_to,
    )
    query = apply_customer_pool_datetime_range(
        query,
        field="recycle_at",
        start=recycle_from,
        end=recycle_to,
    )
    query = apply_customer_pool_datetime_range(
        query,
        field="assigned_at",
        start=assigned_from,
        end=assigned_to,
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
    primary_order, secondary_order = resolve_customer_pool_list_order_by(order_by)
    return query, primary_order, secondary_order
