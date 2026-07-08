"""SPC 样本列表：排序白名单、keyword、采样时间区间。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from apps.kuaizhizao.services.equipment_list_core import (
    apply_equipment_keyword_filter,
    resolve_equipment_list_order_by,
)

SPC_SAMPLE_SORTABLE_FIELDS = frozenset({
    "characteristic_name",
    "chart_type",
    "sample_value",
    "sample_size",
    "sample_time",
    "created_at",
    "updated_at",
})

SPC_SAMPLE_KEYWORD_FIELDS = ["characteristic_name"]

DEFAULT_SPC_SAMPLE_ORDER = "-sample_time"


def apply_spc_sample_search_filters(
    query,
    *,
    keyword: Optional[str] = None,
    characteristic_name: Optional[str] = None,
):
    kw = (keyword or "").strip()
    if kw:
        return apply_equipment_keyword_filter(query, kw, SPC_SAMPLE_KEYWORD_FIELDS)
    if characteristic_name and str(characteristic_name).strip():
        query = query.filter(characteristic_name__icontains=str(characteristic_name).strip())
    return query


def apply_spc_sample_datetime_range(
    query,
    *,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    if start is not None:
        query = query.filter(sample_time__gte=start)
    if end is not None:
        query = query.filter(sample_time__lte=end)
    return query


def resolve_spc_sample_list_order_by(order_by: Optional[str]) -> tuple[str, str]:
    primary = resolve_equipment_list_order_by(
        order_by,
        SPC_SAMPLE_SORTABLE_FIELDS,
        DEFAULT_SPC_SAMPLE_ORDER,
    )
    descending = primary.startswith("-")
    secondary = "-id" if descending else "id"
    return primary, secondary


def apply_spc_sample_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    characteristic_name: Optional[str] = None,
    sample_time_from: Optional[datetime] = None,
    sample_time_to: Optional[datetime] = None,
    order_by: Optional[str] = None,
) -> tuple:
    query = apply_spc_sample_search_filters(
        query,
        keyword=keyword,
        characteristic_name=characteristic_name,
    )
    query = apply_spc_sample_datetime_range(
        query,
        start=sample_time_from,
        end=sample_time_to,
    )
    primary_order, secondary_order = resolve_spc_sample_list_order_by(order_by)
    return query, primary_order, secondary_order
