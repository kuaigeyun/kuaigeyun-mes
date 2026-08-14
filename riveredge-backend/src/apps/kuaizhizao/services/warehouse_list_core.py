"""仓储管理列表查询：排序白名单、keyword、日期区间。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from apps.kuaizhizao.services.equipment_list_core import (
    apply_asset_workflow_list_filters,
    apply_equipment_created_date_range,
    apply_equipment_document_date_range,
    apply_equipment_keyword_filter,
    apply_equipment_updated_date_range,
    pick_search_keyword,
    resolve_equipment_list_order_by,
)

OTHER_INBOUND_SORTABLE_FIELDS = frozenset({
    "inbound_code", "warehouse_name", "reason_type", "status", "receipt_time",
    "receiver_name", "created_at", "updated_at",
})
OTHER_OUTBOUND_SORTABLE_FIELDS = frozenset({
    "outbound_code", "warehouse_name", "reason_type", "status", "delivery_time",
    "deliverer_name", "created_at", "updated_at",
})
MATERIAL_BORROW_SORTABLE_FIELDS = frozenset({
    "borrow_code", "warehouse_name", "borrower_name", "status", "borrow_time",
    "expected_return_date", "created_at", "updated_at",
})
MATERIAL_RETURN_SORTABLE_FIELDS = frozenset({
    "return_code", "borrow_code", "warehouse_name", "returner_name", "status",
    "return_time", "created_at", "updated_at",
})
CUSTOMER_MATERIAL_REGISTRATION_SORTABLE_FIELDS = frozenset({
    "registration_code", "customer_name", "barcode", "mapped_material_code",
    "mapped_material_name", "status", "registration_date", "created_at", "updated_at",
})
INVENTORY_TRANSFER_SORTABLE_FIELDS = frozenset({
    "code", "from_warehouse_name", "to_warehouse_name", "transfer_date", "status",
    "total_items", "total_quantity", "total_amount", "created_at", "updated_at",
})
STOCKTAKING_SORTABLE_FIELDS = frozenset({
    "code", "warehouse_name", "stocktaking_date", "stocktaking_type", "status",
    "total_items", "counted_items", "total_differences", "total_difference_amount",
    "created_at", "updated_at",
})
ASSEMBLY_ORDER_SORTABLE_FIELDS = frozenset({
    "code", "warehouse_name", "assembly_date", "status", "product_material_code",
    "product_material_name", "total_quantity", "total_items", "created_at", "updated_at",
})
DISASSEMBLY_ORDER_SORTABLE_FIELDS = frozenset({
    "code", "warehouse_name", "disassembly_date", "status", "product_material_code",
    "product_material_name", "total_quantity", "total_items", "created_at", "updated_at",
})
DELIVERY_NOTICE_SORTABLE_FIELDS = frozenset({
    "notice_code", "customer_name", "sales_delivery_code", "sales_order_code", "carrier",
    "tracking_number", "status", "planned_delivery_date", "sent_at", "created_at", "updated_at",
})

OTHER_INBOUND_KEYWORD_FIELDS = ["inbound_code", "warehouse_name", "reason_desc", "receiver_name"]
OTHER_OUTBOUND_KEYWORD_FIELDS = ["outbound_code", "warehouse_name", "reason_desc", "deliverer_name"]
MATERIAL_BORROW_KEYWORD_FIELDS = ["borrow_code", "warehouse_name", "borrower_name", "department"]
MATERIAL_RETURN_KEYWORD_FIELDS = ["return_code", "borrow_code", "warehouse_name", "returner_name"]
SALES_DELIVERY_KEYWORD_FIELDS = [
    "delivery_code",
    "customer_name",
    "warehouse_name",
    "sales_order_code",
    "deliverer_name",
]
PRODUCTION_PICKING_KEYWORD_FIELDS = [
    "picking_code",
    "work_order_code",
    "picker_name",
    "workshop_name",
]
SALES_DELIVERY_SORTABLE_FIELDS = frozenset({
    "delivery_code", "customer_name", "warehouse_name", "status", "delivery_time",
    "total_quantity", "total_amount", "created_at", "updated_at",
})
PRODUCTION_PICKING_SORTABLE_FIELDS = frozenset({
    "picking_code", "work_order_code", "status", "picking_time",
    "picker_name", "created_at", "updated_at",
})
CUSTOMER_MATERIAL_REGISTRATION_KEYWORD_FIELDS = [
    "registration_code",
    "customer_name",
    "barcode",
    "mapped_material_code",
    "mapped_material_name",
]
DELIVERY_NOTICE_KEYWORD_FIELDS = [
    "notice_code",
    "sales_delivery_code",
    "sales_order_code",
    "customer_name",
    "carrier",
    "tracking_number",
]
STOCKTAKING_KEYWORD_FIELDS = ["code", "warehouse_name", "created_by_name", "remarks"]
INVENTORY_TRANSFER_KEYWORD_FIELDS = [
    "code", "from_warehouse_name", "to_warehouse_name", "transfer_reason", "remarks",
]
ASSEMBLY_ORDER_KEYWORD_FIELDS = [
    "code", "warehouse_name", "product_material_code", "product_material_name",
    "executed_by_name", "remarks",
]
DISASSEMBLY_ORDER_KEYWORD_FIELDS = ASSEMBLY_ORDER_KEYWORD_FIELDS

INVENTORY_MATERIAL_BALANCE_SORTABLE_FIELDS = frozenset({
    "material_code", "material_name", "warehouse_name", "quantity", "in_transit_quantity",
    "status", "brand", "texture", "model", "material_unit",
})
INVENTORY_BATCH_LINE_SORTABLE_FIELDS = frozenset({
    "material_code", "material_name", "batch_no", "warehouse_name", "quantity",
    "in_transit_quantity", "production_date", "expiry_date", "status", "supplier_batch_no",
})
LINE_SIDE_INVENTORY_SORTABLE_FIELDS = frozenset({
    "warehouse_name", "material_code", "material_name", "batch_no", "quantity",
    "reserved_quantity", "work_order_code", "updated_at", "created_at",
})
BACKFLUSH_RECORD_SORTABLE_FIELDS = frozenset({
    "work_order_code", "operation_code", "material_code", "material_name", "batch_no",
    "warehouse_name", "report_quantity", "backflush_quantity", "status", "created_at",
})
REPLENISHMENT_SUGGESTION_SORTABLE_FIELDS = frozenset({
    "material_code", "material_name", "warehouse_name", "current_quantity", "safety_stock",
    "suggested_quantity", "priority", "suggestion_type", "status", "supplier_name",
    "suggested_order_date", "created_at", "updated_at",
})
INVENTORY_ALERT_SORTABLE_FIELDS = frozenset({
    "material_code", "material_name", "warehouse_name", "current_quantity", "threshold_value",
    "alert_level", "alert_type", "status", "triggered_at", "created_at",
})
INVENTORY_ALERT_RULE_SORTABLE_FIELDS = frozenset({
    "code", "name", "alert_type", "material_code", "material_name", "warehouse_name",
    "threshold_value", "is_enabled", "created_at", "updated_at",
})
BARCODE_MAPPING_RULE_SORTABLE_FIELDS = frozenset({
    "code", "name", "customer_name", "barcode_pattern", "material_code", "material_name",
    "priority", "is_enabled", "created_at", "updated_at",
})
BATCHING_CENTER_TASK_SORTABLE_FIELDS = frozenset({
    "work_order_code", "doc_code", "material_code", "material_name", "product_name",
    "priority", "status", "picking_score", "created_at", "updated_at",
})

LINE_SIDE_INVENTORY_KEYWORD_FIELDS = [
    "material_code", "material_name", "warehouse_name", "batch_no", "work_order_code",
]
BACKFLUSH_RECORD_KEYWORD_FIELDS = [
    "work_order_code", "operation_code", "material_code", "material_name", "batch_no", "warehouse_name",
]
REPLENISHMENT_SUGGESTION_KEYWORD_FIELDS = [
    "material_code", "material_name", "warehouse_name", "supplier_name", "remarks", "related_demand_code",
]
INVENTORY_ALERT_KEYWORD_FIELDS = ["material_code", "material_name", "warehouse_name", "alert_message"]
INVENTORY_ALERT_RULE_KEYWORD_FIELDS = [
    "code", "name", "material_code", "material_name", "warehouse_name", "remarks",
]
BARCODE_MAPPING_RULE_KEYWORD_FIELDS = [
    "code", "name", "customer_name", "barcode_pattern", "material_code", "material_name",
]
BATCHING_CENTER_TASK_KEYWORD_FIELDS = [
    "work_order_code", "doc_code", "material_code", "material_name", "product_name",
]


def sort_inventory_report_rows(
    rows: List[Dict[str, Any]],
    order_by: Optional[str],
    allowed_fields: frozenset,
    default_order: str = "material_code",
) -> List[Dict[str, Any]]:
    order_clause = resolve_equipment_list_order_by(order_by, allowed_fields, default_order)
    reverse = order_clause.startswith("-")
    field = order_clause.lstrip("-")
    numeric_fields = frozenset({
        "quantity", "in_transit_quantity", "reserved_quantity", "current_quantity",
        "threshold_value", "suggested_quantity", "safety_stock", "picking_score", "priority",
    })

    def sort_key(row: Dict[str, Any]):
        val = row.get(field)
        if val is None:
            return (1, 0.0) if field in numeric_fields else (1, "")
        if field in numeric_fields:
            try:
                return (0, float(val))
            except (TypeError, ValueError):
                return (0, 0.0)
        return (0, str(val).lower())

    rows.sort(key=sort_key, reverse=reverse)
    return rows


def apply_warehouse_doc_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    search: Optional[str] = None,
    order_by: Optional[str] = None,
    allowed_fields: frozenset,
    default_order: str = "-created_at",
    keyword_fields: List[str],
    doc_date_field: Optional[str] = None,
    doc_start_date: Optional[str] = None,
    doc_end_date: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    return apply_asset_workflow_list_filters(
        query,
        keyword=keyword,
        search=search,
        order_by=order_by,
        allowed_fields=allowed_fields,
        default_order=default_order,
        keyword_fields=keyword_fields,
        date_field=doc_date_field,
        date_start=doc_start_date,
        date_end=doc_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


def apply_warehouse_registration_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    search: Optional[str] = None,
    order_by: Optional[str] = None,
    registration_start_date: Optional[str] = None,
    registration_end_date: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_equipment_keyword_filter(
        query,
        pick_search_keyword(keyword, search),
        CUSTOMER_MATERIAL_REGISTRATION_KEYWORD_FIELDS,
    )
    query = apply_equipment_document_date_range(
        query,
        date_field="registration_date",
        start_date=registration_start_date,
        end_date=registration_end_date,
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
    order_clause = resolve_equipment_list_order_by(
        order_by,
        CUSTOMER_MATERIAL_REGISTRATION_SORTABLE_FIELDS,
        "-registration_date",
    )
    return query, order_clause


def apply_delivery_notice_list_filters(
    query,
    *,
    keyword: Optional[str] = None,
    search: Optional[str] = None,
    order_by: Optional[str] = None,
    sent_start_date: Optional[str] = None,
    sent_end_date: Optional[str] = None,
    planned_delivery_start_date: Optional[str] = None,
    planned_delivery_end_date: Optional[str] = None,
    created_start_date: Optional[str] = None,
    created_end_date: Optional[str] = None,
    updated_start_date: Optional[str] = None,
    updated_end_date: Optional[str] = None,
):
    query = apply_equipment_keyword_filter(
        query,
        pick_search_keyword(keyword, search),
        DELIVERY_NOTICE_KEYWORD_FIELDS,
    )
    query = apply_equipment_document_date_range(
        query,
        date_field="sent_at",
        start_date=sent_start_date,
        end_date=sent_end_date,
    )
    query = apply_equipment_document_date_range(
        query,
        date_field="planned_delivery_date",
        start_date=planned_delivery_start_date,
        end_date=planned_delivery_end_date,
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
    order_clause = resolve_equipment_list_order_by(
        order_by,
        DELIVERY_NOTICE_SORTABLE_FIELDS,
        "-created_at",
    )
    return query, order_clause
