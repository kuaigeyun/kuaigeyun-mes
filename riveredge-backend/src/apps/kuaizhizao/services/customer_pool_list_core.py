"""客户池列表：排序白名单、keyword、日期区间。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Sequence

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

_STANDARD_POOL_STATUSES = ("pool", "owned")


def resolve_customer_pool_status_display(
    pool_status: Optional[str],
    salesman_id: Optional[int],
) -> str:
    """与 _to_customer_pool_item 展示逻辑一致：pool / owned。"""
    raw_pool_status = str(pool_status or "").strip().lower()
    if raw_pool_status in _STANDARD_POOL_STATUSES:
        return raw_pool_status
    if salesman_id:
        return "owned"
    return "pool"


def customer_pool_effective_owned_q() -> Q:
    """DB 条件：resolve_customer_pool_status_display(...) == 'owned'。"""
    return Q(pool_status="owned") | (
        Q(salesman_id__isnull=False) & ~Q(pool_status__in=list(_STANDARD_POOL_STATUSES))
    )


def customer_pool_effective_public_q() -> Q:
    """DB 条件：resolve_customer_pool_status_display(...) == 'pool'。"""
    return Q(pool_status="pool") | (
        Q(salesman_id__isnull=True) & ~Q(pool_status__in=list(_STANDARD_POOL_STATUSES))
    )


def customer_pool_mine_scope_q(*, current_user_id: int, collaborator_customer_ids: Sequence[int]) -> Q:
    """私有客户 tab：归属本人或协作客户（以 salesman_id 为准，不依赖 pool_status 脏数据）。"""
    clause = Q(salesman_id=current_user_id)
    if collaborator_customer_ids:
        clause |= Q(id__in=list(collaborator_customer_ids))
    return clause


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
