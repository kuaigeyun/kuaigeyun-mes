"""设备管理列表查询：排序白名单、keyword、日期区间。"""

from __future__ import annotations

from datetime import datetime, time as dt_time
from typing import Any, List, Optional

from tortoise.expressions import Q

from apps.kuaizhizao.services.quality_service import (
    _parse_optional_api_date,
    _resolve_quality_list_order_by,
)

SPOT_CHECK_SORTABLE_FIELDS = frozenset({
    "document_no", "equipment_code", "equipment_name", "check_date",
    "inspector_name", "status", "has_abnormality", "created_at", "updated_at",
})
ROUTE_PATROL_SORTABLE_FIELDS = frozenset({
    "document_no", "route_code", "route_name", "patrol_date",
    "inspector_name", "status", "has_abnormality", "created_at", "updated_at",
})
EQUIPMENT_FAULT_SORTABLE_FIELDS = frozenset({
    "fault_no", "equipment_code", "equipment_name", "fault_date", "fault_type",
    "fault_level", "status", "repair_required", "created_at", "updated_at",
})
EQUIPMENT_REPAIR_SORTABLE_FIELDS = frozenset({
    "repair_no", "equipment_name", "repair_date", "repair_type", "repairer_name",
    "status", "repair_result", "created_at", "updated_at",
})
MAINTENANCE_PLAN_SORTABLE_FIELDS = frozenset({
    "plan_no", "plan_name", "plan_type", "equipment_name", "maintenance_type",
    "planned_start_date", "planned_end_date", "status", "created_at", "updated_at",
})
MAINTENANCE_EXECUTION_SORTABLE_FIELDS = frozenset({
    "execution_no", "equipment_name", "execution_date", "executor_name",
    "execution_result", "status", "created_at", "updated_at",
})
SPARE_PART_REQUISITION_SORTABLE_FIELDS = frozenset({
    "requisition_no", "equipment_name", "purpose", "applicant_name",
    "status", "created_at", "updated_at",
})
EQUIPMENT_SCRAP_SORTABLE_FIELDS = frozenset({
    "application_no", "equipment_name", "reason", "scrap_date", "applicant_name",
    "status", "created_at", "updated_at",
})
EQUIPMENT_TRANSFER_SORTABLE_FIELDS = frozenset({
    "application_no", "equipment_name", "from_workshop_name", "to_workshop_name",
    "transfer_date", "status", "created_at", "updated_at",
})
MASTER_CRUD_SORTABLE_FIELDS = frozenset({
    "code", "name", "is_active", "created_at", "updated_at",
})
SPARE_PART_MASTER_SORTABLE_FIELDS = frozenset({
    "part_no", "part_name", "category", "brand", "is_active", "created_at", "updated_at",
})
EQUIPMENT_LEDGER_SORTABLE_FIELDS = frozenset({
    "code", "name", "type", "category", "equipment_nature", "status", "is_active",
    "workshop_name", "production_line_name", "responsible_person_name",
    "created_at", "updated_at",
})
MOLD_LEDGER_SORTABLE_FIELDS = frozenset({
    "code", "name", "status", "is_active", "created_at", "updated_at",
})
TOOL_LEDGER_SORTABLE_FIELDS = frozenset({
    "code", "name", "status", "is_active", "created_at", "updated_at",
})
MOLD_WORKFLOW_DOC_SORTABLE_FIELDS = frozenset({
    "document_no", "mold_code", "mold_name", "status", "created_at", "updated_at",
})
TOOL_WORKFLOW_DOC_SORTABLE_FIELDS = frozenset({
    "document_no", "tool_code", "tool_name", "status", "created_at", "updated_at",
})
MOLD_SCRAP_SORTABLE_FIELDS = frozenset({
    "application_no", "mold_code", "mold_name", "reason", "status", "created_at", "updated_at",
})
TOOL_SCRAP_SORTABLE_FIELDS = frozenset({
    "application_no", "tool_code", "tool_name", "reason", "status", "created_at", "updated_at",
})
EQUIPMENT_CALIBRATION_SORTABLE_FIELDS = frozenset({
    "calibration_date", "expiry_date", "result", "certificate_no", "created_at", "updated_at",
})
MAINTENANCE_REMINDER_SORTABLE_FIELDS = frozenset({
    "equipment_name", "plan_name", "reminder_type", "reminder_date", "is_read", "is_handled", "created_at",
})

MOLD_WORKFLOW_KEYWORD_FIELDS = ["document_no", "mold_code", "mold_name", "borrower_name", "operator_name"]
TOOL_WORKFLOW_KEYWORD_FIELDS = ["document_no", "tool_code", "tool_name", "borrower_name", "operator_name"]


def resolve_equipment_list_order_by(
    order_by: Optional[str],
    allowed: frozenset,
    default: str,
) -> str:
    return _resolve_quality_list_order_by(order_by, allowed, default)


def apply_equipment_keyword_filter(query, keyword: Optional[str], fields: List[str]):
    kw = (keyword or "").strip()
    if not kw:
        return query
    cond = Q()
    for field in fields:
        cond |= Q(**{f"{field}__icontains": kw})
    return query.filter(cond)


def apply_equipment_document_date_range(
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


def apply_equipment_created_date_range(
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


def apply_equipment_updated_date_range(
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


def pick_search_keyword(keyword: Optional[str] = None, search: Optional[str] = None) -> Optional[str]:
    for value in (keyword, search):
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def apply_master_crud_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    order_by: Optional[str] = None,
    allowed_fields: frozenset = MASTER_CRUD_SORTABLE_FIELDS,
    default_order: str = "-updated_at",
    keyword_fields: Optional[List[str]] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    if is_active is not None:
        query = query.filter(is_active=is_active)
    fields = keyword_fields or ["code", "name"]
    query = apply_equipment_keyword_filter(query, pick_search_keyword(keyword, search), fields)
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
    order_clause = resolve_equipment_list_order_by(order_by, allowed_fields, default_order)
    return query, order_clause


def apply_asset_workflow_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    search: Optional[str] = None,
    order_by: Optional[str] = None,
    allowed_fields: frozenset,
    default_order: str = "-updated_at",
    keyword_fields: List[str],
    date_field: Optional[str] = None,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_equipment_keyword_filter(
        query,
        pick_search_keyword(keyword, search),
        keyword_fields,
    )
    if date_field:
        query = apply_equipment_document_date_range(
            query,
            date_field=date_field,
            start_date=date_start,
            end_date=date_end,
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
    order_clause = resolve_equipment_list_order_by(order_by, allowed_fields, default_order)
    return query, order_clause
