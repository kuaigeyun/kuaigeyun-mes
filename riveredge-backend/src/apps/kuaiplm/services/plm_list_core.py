"""快研发列表：keyword、日期区间、排序（camelCase API 字段）。"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time
from typing import Dict, List, Optional, Tuple

from tortoise.expressions import Q

PLM_FIELD_ALIASES: Dict[str, str] = {
    "projectCode": "project_code",
    "projectName": "project_name",
    "projectType": "project_type",
    "materialName": "material_name",
    "materialCode": "material_code",
    "ownerName": "owner_name",
    "plannedEndDate": "planned_end_date",
    "plannedStartDate": "planned_start_date",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "requirementCode": "requirement_code",
    "reviewCode": "review_code",
    "fmeaCode": "fmea_code",
    "reviewType": "review_type",
    "reviewDate": "review_date",
    "fmeaType": "fmea_type",
    "title": "title",
    "status": "status",
    "priority": "priority",
}

RD_PROJECT_SORT_DB_COLS = frozenset({
    "project_code",
    "project_name",
    "project_type",
    "status",
    "material_name",
    "material_code",
    "owner_name",
    "planned_end_date",
    "planned_start_date",
    "created_at",
    "updated_at",
})

PHASE2_REQUIREMENT_SORT_DB_COLS = frozenset({
    "requirement_code",
    "title",
    "priority",
    "status",
    "created_at",
    "updated_at",
})

PHASE2_DESIGN_REVIEW_SORT_DB_COLS = frozenset({
    "review_code",
    "title",
    "review_type",
    "status",
    "review_date",
    "reviewer_name",
    "created_at",
    "updated_at",
})

PHASE2_FMEA_SORT_DB_COLS = frozenset({
    "fmea_code",
    "title",
    "fmea_type",
    "status",
    "created_at",
    "updated_at",
})


def _parse_optional_api_date(value: Optional[str]) -> Optional[date]:
    if value is None or not str(value).strip():
        return None
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        return None


def apply_plm_keyword_filter(
    query,
    *,
    keyword: Optional[str] = None,
    keyword_fields: Optional[List[str]] = None,
    exact_fields: Optional[Dict[str, Optional[str]]] = None,
):
    fields = keyword_fields or []
    kw = (keyword or "").strip()
    if kw and fields:
        cond = Q()
        for field in fields:
            cond |= Q(**{f"{field}__icontains": kw})
        return query.filter(cond)

    if exact_fields:
        for field, value in exact_fields.items():
            if value and str(value).strip():
                query = query.filter(**{f"{field}__icontains": str(value).strip()})
    return query


def apply_plm_created_date_range(
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


def apply_plm_updated_date_range(
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


def resolve_plm_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    allowed_cols: frozenset[str],
    default_col: str = "created_at",
) -> str:
    key = (sort_field or "").strip()
    if key in allowed_cols:
        col = key
    elif key in PLM_FIELD_ALIASES and PLM_FIELD_ALIASES[key] in allowed_cols:
        col = PLM_FIELD_ALIASES[key]
    else:
        col = default_col if default_col in allowed_cols else "created_at"
    if (sort_order or "desc").lower() == "desc":
        return f"-{col}"
    return col


def apply_plm_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    keyword_fields: Optional[List[str]] = None,
    exact_fields: Optional[Dict[str, Optional[str]]] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    allowed_sort_cols: frozenset[str],
    default_sort_col: str = "created_at",
) -> Tuple:
    query = apply_plm_keyword_filter(
        query,
        keyword=keyword,
        keyword_fields=keyword_fields,
        exact_fields=exact_fields,
    )
    query = apply_plm_created_date_range(
        query,
        start_date=created_start_date,
        end_date=created_end_date,
    )
    query = apply_plm_updated_date_range(
        query,
        start_date=updated_start_date,
        end_date=updated_end_date,
    )
    order_expr = resolve_plm_order_clause(
        sort_field,
        sort_order,
        allowed_cols=allowed_sort_cols,
        default_col=default_sort_col,
    )
    return query, order_expr
