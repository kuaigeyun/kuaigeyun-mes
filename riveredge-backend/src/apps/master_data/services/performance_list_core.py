"""绩效管理列表查询：排序白名单、keyword、日期区间。"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time
from typing import Dict, List, Optional

from tortoise.expressions import Q

PERFORMANCE_FIELD_ALIASES: Dict[str, str] = {
    "holidayDate": "holiday_date",
    "holidayType": "holiday_type",
    "isActive": "is_active",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "startTime": "start_time",
    "endTime": "end_time",
    "crossesMidnight": "crosses_midnight",
    "standardHours": "standard_hours",
    "employeeName": "employee_name",
    "calcMode": "calc_mode",
    "departmentName": "department_name",
    "positionName": "position_name",
    "calcType": "calc_type",
    "totalHours": "total_hours",
    "totalPieces": "total_pieces",
    "timeAmount": "time_amount",
    "pieceAmount": "piece_amount",
    "totalAmount": "total_amount",
    "kpiScore": "kpi_score",
    "kpiCoefficient": "kpi_coefficient",
}

HOLIDAY_SORTABLE_FIELDS = frozenset({
    "name", "holiday_date", "holiday_type", "is_active", "created_at", "updated_at",
})
SKILL_SORTABLE_FIELDS = frozenset({
    "code", "name", "category", "is_active", "created_at", "updated_at",
})
SHIFT_SORTABLE_FIELDS = frozenset({
    "code", "name", "start_time", "end_time", "crosses_midnight", "standard_hours",
    "is_active", "created_at", "updated_at",
})
EMPLOYEE_CONFIG_SORTABLE_FIELDS = frozenset({
    "employee_name", "calc_mode", "hourly_rate", "default_piece_rate", "base_salary",
    "effective_from", "effective_to", "is_active", "created_at", "updated_at",
})
HOURLY_RATE_SORTABLE_FIELDS = frozenset({
    "department_name", "position_name", "rate", "effective_from", "effective_to",
    "is_active", "created_at", "updated_at",
})
KPI_DEFINITION_SORTABLE_FIELDS = frozenset({
    "code", "name", "weight", "calc_type", "is_active", "created_at", "updated_at",
})
PERFORMANCE_SUMMARY_SORTABLE_FIELDS = frozenset({
    "employee_name", "period", "total_hours", "total_pieces", "time_amount", "piece_amount",
    "total_amount", "kpi_score", "kpi_coefficient", "status", "created_at", "updated_at",
})

HOLIDAY_KEYWORD_FIELDS = ["name", "holiday_type", "description"]
SKILL_KEYWORD_FIELDS = ["code", "name", "category", "description"]
SHIFT_KEYWORD_FIELDS = ["code", "name"]
EMPLOYEE_CONFIG_KEYWORD_FIELDS = ["employee_name"]
HOURLY_RATE_KEYWORD_FIELDS = ["department_name", "position_name"]
KPI_DEFINITION_KEYWORD_FIELDS = ["code", "name"]
PERFORMANCE_SUMMARY_KEYWORD_FIELDS = ["employee_name", "period"]


def _parse_optional_api_date(value: Optional[str]) -> Optional[date]:
    if value is None or not str(value).strip():
        return None
    return date.fromisoformat(str(value).strip()[:10])


def pick_search_keyword(keyword: Optional[str] = None, search: Optional[str] = None) -> Optional[str]:
    for value in (keyword, search):
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def resolve_performance_list_order_by(
    order_by: Optional[str],
    allowed: frozenset,
    default: str,
) -> str:
    if not order_by:
        return default
    descending = str(order_by).startswith("-")
    field = str(order_by).lstrip("-")
    field = PERFORMANCE_FIELD_ALIASES.get(field, field)
    if field not in allowed:
        return default
    return f"-{field}" if descending else field


def apply_performance_keyword_filter(query, keyword: Optional[str], fields: List[str]):
    kw = (keyword or "").strip()
    if not kw:
        return query
    cond = Q()
    for field in fields:
        cond |= Q(**{f"{field}__icontains": kw})
    return query.filter(cond)


def apply_performance_date_range(
    query,
    *,
    date_field: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    start = _parse_optional_api_date(start_date)
    end = _parse_optional_api_date(end_date)
    if start is not None:
        query = query.filter(**{f"{date_field}__gte": start})
    if end is not None:
        query = query.filter(**{f"{date_field}__lte": end})
    return query


def apply_performance_created_date_range(
    query,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    start = _parse_optional_api_date(start_date)
    end = _parse_optional_api_date(end_date)
    if start is not None:
        query = query.filter(created_at__gte=datetime.combine(start, dt_time.min))
    if end is not None:
        query = query.filter(created_at__lte=datetime.combine(end, dt_time.max))
    return query


def apply_performance_updated_date_range(
    query,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    start = _parse_optional_api_date(start_date)
    end = _parse_optional_api_date(end_date)
    if start is not None:
        query = query.filter(updated_at__gte=datetime.combine(start, dt_time.min))
    if end is not None:
        query = query.filter(updated_at__lte=datetime.combine(end, dt_time.max))
    return query


def apply_holiday_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    holiday_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_performance_keyword_filter(query, pick_search_keyword(keyword), HOLIDAY_KEYWORD_FIELDS)
    if holiday_type is not None:
        query = query.filter(holiday_type=holiday_type)
    query = apply_performance_date_range(
        query, date_field="holiday_date", start_date=start_date, end_date=end_date,
    )
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_performance_created_date_range(
        query, start_date=created_start_date, end_date=created_end_date,
    )
    query = apply_performance_updated_date_range(
        query, start_date=updated_start_date, end_date=updated_end_date,
    )
    order_clause = resolve_performance_list_order_by(order_by, HOLIDAY_SORTABLE_FIELDS, "-holiday_date")
    return query, order_clause


def apply_skill_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_performance_keyword_filter(query, pick_search_keyword(keyword), SKILL_KEYWORD_FIELDS)
    if category is not None:
        query = query.filter(category=category)
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_performance_created_date_range(
        query, start_date=created_start_date, end_date=created_end_date,
    )
    query = apply_performance_updated_date_range(
        query, start_date=updated_start_date, end_date=updated_end_date,
    )
    order_clause = resolve_performance_list_order_by(order_by, SKILL_SORTABLE_FIELDS, "code")
    return query, order_clause


def apply_shift_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_performance_keyword_filter(query, pick_search_keyword(keyword), SHIFT_KEYWORD_FIELDS)
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_performance_created_date_range(
        query, start_date=created_start_date, end_date=created_end_date,
    )
    query = apply_performance_updated_date_range(
        query, start_date=updated_start_date, end_date=updated_end_date,
    )
    order_clause = resolve_performance_list_order_by(order_by, SHIFT_SORTABLE_FIELDS, "code")
    return query, order_clause


def apply_employee_config_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    employee_id: Optional[int] = None,
    calc_mode: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_performance_keyword_filter(
        query, pick_search_keyword(keyword), EMPLOYEE_CONFIG_KEYWORD_FIELDS,
    )
    if employee_id is not None:
        query = query.filter(employee_id=employee_id)
    if calc_mode is not None:
        query = query.filter(calc_mode=calc_mode)
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_performance_created_date_range(
        query, start_date=created_start_date, end_date=created_end_date,
    )
    query = apply_performance_updated_date_range(
        query, start_date=updated_start_date, end_date=updated_end_date,
    )
    order_clause = resolve_performance_list_order_by(
        order_by, EMPLOYEE_CONFIG_SORTABLE_FIELDS, "employee_name",
    )
    return query, order_clause


def apply_hourly_rate_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_performance_keyword_filter(
        query, pick_search_keyword(keyword), HOURLY_RATE_KEYWORD_FIELDS,
    )
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_performance_created_date_range(
        query, start_date=created_start_date, end_date=created_end_date,
    )
    query = apply_performance_updated_date_range(
        query, start_date=updated_start_date, end_date=updated_end_date,
    )
    order_clause = resolve_performance_list_order_by(order_by, HOURLY_RATE_SORTABLE_FIELDS, "-updated_at")
    return query, order_clause


def apply_kpi_definition_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    calc_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_performance_keyword_filter(
        query, pick_search_keyword(keyword), KPI_DEFINITION_KEYWORD_FIELDS,
    )
    if calc_type is not None:
        query = query.filter(calc_type=calc_type)
    if is_active is not None:
        query = query.filter(is_active=is_active)
    query = apply_performance_created_date_range(
        query, start_date=created_start_date, end_date=created_end_date,
    )
    query = apply_performance_updated_date_range(
        query, start_date=updated_start_date, end_date=updated_end_date,
    )
    order_clause = resolve_performance_list_order_by(order_by, KPI_DEFINITION_SORTABLE_FIELDS, "code")
    return query, order_clause


def apply_performance_summary_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    period: Optional[str] = None,
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_performance_keyword_filter(
        query, pick_search_keyword(keyword), PERFORMANCE_SUMMARY_KEYWORD_FIELDS,
    )
    if period:
        query = query.filter(period=period)
    if employee_id is not None:
        query = query.filter(employee_id=employee_id)
    if status is not None:
        query = query.filter(status=status)
    query = apply_performance_created_date_range(
        query, start_date=created_start_date, end_date=created_end_date,
    )
    query = apply_performance_updated_date_range(
        query, start_date=updated_start_date, end_date=updated_end_date,
    )
    order_clause = resolve_performance_list_order_by(
        order_by, PERFORMANCE_SUMMARY_SORTABLE_FIELDS, "-period",
    )
    return query, order_clause
