"""主数据 CRUD 列表：keyword、日期区间、排序（camelCase API 字段）。"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time
from typing import Dict, List, Optional, Tuple

from tortoise.expressions import Q

MASTER_CRUD_FIELD_ALIASES: Dict[str, str] = {
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "isActive": "is_active",
    "plantId": "plant_id",
    "workshopId": "workshop_id",
    "productionLineId": "production_line_id",
    "warehouseId": "warehouse_id",
    "storageAreaId": "storage_area_id",
    "warehouseType": "warehouse_type",
}

MASTER_CRUD_SORT_API_FIELDS = frozenset({
    "code",
    "name",
    "createdAt",
    "updatedAt",
    "isActive",
    "plantId",
    "workshopId",
    "productionLineId",
    "warehouseId",
    "storageAreaId",
    "warehouseType",
})

MASTER_CRUD_SORT_DB_COLS = frozenset({
    "code",
    "name",
    "created_at",
    "updated_at",
    "is_active",
    "description",
    "seq_reset_rule",
    "display_order",
    "attribute_name",
    "display_name",
    "main_code",
    "batch_no",
    "serial_no",
    "status",
    "production_date",
    "expiry_date",
    "factory_date",
    "quantity",
    "category",
    "reporting_type",
    "version",
    "operation_id",
    "unit_price",
    "effective_from",
    "effective_to",
    "short_name",
    "salesman_name",
    "buyer_name",
})

MASTER_CRUD_KEYWORD_FIELDS = ["code", "name"]


def _parse_optional_api_date(value: Optional[str]) -> Optional[date]:
    if value is None or not str(value).strip():
        return None
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        return None


def apply_master_crud_search_filters(
    query,
    *,
    keyword: Optional[str] = None,
    code: Optional[str] = None,
    name: Optional[str] = None,
    keyword_fields: Optional[List[str]] = None,
):
    fields = keyword_fields or MASTER_CRUD_KEYWORD_FIELDS
    kw = (keyword or "").strip()
    if kw:
        cond = Q()
        for field in fields:
            cond |= Q(**{f"{field}__icontains": kw})
        return query.filter(cond)
    if code and str(code).strip():
        query = query.filter(code__icontains=str(code).strip())
    if name and str(name).strip():
        query = query.filter(name__icontains=str(name).strip())
    return query


def apply_master_crud_created_date_range(
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


def apply_master_crud_updated_date_range(
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


def resolve_master_crud_order_clause(
    sort_field: Optional[str],
    sort_order: Optional[str],
    *,
    default_col: str = "code",
) -> str:
    key = (sort_field or "").strip()
    if key in MASTER_CRUD_SORT_DB_COLS:
        col = key
    elif key in MASTER_CRUD_SORT_API_FIELDS:
        col = MASTER_CRUD_FIELD_ALIASES.get(key, key)
    else:
        col = MASTER_CRUD_FIELD_ALIASES.get(key, key if key in ("code", "name") else default_col)
    if (sort_order or "asc").lower() == "desc":
        return f"-{col}"
    return col


def apply_master_crud_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    code: Optional[str] = None,
    name: Optional[str] = None,
    keyword_fields: Optional[List[str]] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    default_sort_col: str = "code",
) -> Tuple:
    query = apply_master_crud_search_filters(
        query,
        keyword=keyword,
        code=code,
        name=name,
        keyword_fields=keyword_fields,
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
    order_expr = resolve_master_crud_order_clause(
        sort_field,
        sort_order,
        default_col=default_sort_col,
    )
    return query, order_expr
