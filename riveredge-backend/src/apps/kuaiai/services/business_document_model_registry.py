"""业务单据 resource_key → 模型详情字段（KU-AI 查单详情扩展）。"""

from __future__ import annotations

import importlib
from typing import Any, Callable

from tortoise.models import Model

DetailLoader = Callable[[Model], dict[str, Any]]

_COMMON_DOC_FIELDS = (
    "id",
    "uuid",
    "status",
    "review_status",
    "created_at",
    "updated_at",
    "remarks",
    "remark",
)


def _pick_fields(obj: Model, fields: tuple[str, ...]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name in fields:
        if hasattr(obj, name):
            val = getattr(obj, name)
            if hasattr(val, "isoformat"):
                val = val.isoformat()
            out[name] = val
    return out


def _work_order_detail(obj: Model) -> dict[str, Any]:
    return _pick_fields(
        obj,
        _COMMON_DOC_FIELDS
        + (
            "code",
            "name",
            "product_code",
            "product_name",
            "quantity",
            "completed_quantity",
            "qualified_quantity",
            "production_mode",
            "workshop_name",
            "planned_start_date",
            "planned_end_date",
            "actual_start_date",
            "actual_end_date",
            "sales_order_code",
        ),
    )


def _sales_order_detail(obj: Model) -> dict[str, Any]:
    return _pick_fields(
        obj,
        _COMMON_DOC_FIELDS
        + ("order_code", "customer_name", "order_date", "delivery_date", "total_amount"),
    )


def _purchase_order_detail(obj: Model) -> dict[str, Any]:
    return _pick_fields(
        obj,
        _COMMON_DOC_FIELDS
        + ("order_code", "supplier_name", "order_date", "expected_date", "total_amount"),
    )


def _outsource_order_detail(obj: Model) -> dict[str, Any]:
    return _pick_fields(
        obj,
        _COMMON_DOC_FIELDS
        + ("order_code", "supplier_name", "material_code", "material_name", "quantity", "received_quantity"),
    )


def _warehouse_doc_detail(obj: Model) -> dict[str, Any]:
    base = _pick_fields(obj, _COMMON_DOC_FIELDS)
    for alt in ("receipt_code", "delivery_code", "return_code", "inbound_code", "outbound_code", "picking_code"):
        if hasattr(obj, alt):
            base[alt] = getattr(obj, alt)
    for alt in ("supplier_name", "customer_name", "work_order_code", "warehouse_name"):
        if hasattr(obj, alt):
            base[alt] = getattr(obj, alt)
    return base


def _inspection_detail(obj: Model) -> dict[str, Any]:
    return _pick_fields(
        obj,
        _COMMON_DOC_FIELDS
        + (
            "inspection_code",
            "material_code",
            "material_name",
            "inspection_quantity",
            "qualified_quantity",
            "unqualified_quantity",
            "inspection_result",
            "quality_status",
            "source_code",
        ),
    )


def _rolling_plan_detail(obj: Model) -> dict[str, Any]:
    return _pick_fields(
        obj,
        _COMMON_DOC_FIELDS
        + ("plan_code", "plan_date", "published_at", "closed_at", "notes"),
    )


_REGISTRY: dict[str, tuple[str, DetailLoader]] = {
    "kuaizhizao:work-order": ("apps.kuaizhizao.models.work_order.WorkOrder", _work_order_detail),
    "kuaizhizao:sales-order": ("apps.kuaizhizao.models.sales_order.SalesOrder", _sales_order_detail),
    "kuaizhizao:purchase-order": ("apps.kuaizhizao.models.purchase_order.PurchaseOrder", _purchase_order_detail),
    "kuaizhizao:rework-order": ("apps.kuaizhizao.models.rework_order.ReworkOrder", _work_order_detail),
    "kuaizhizao:outsource-order": ("apps.kuaizhizao.models.outsource_order.OutsourceOrder", _outsource_order_detail),
    "kuaizhizao:outsource-work-order": (
        "apps.kuaizhizao.models.outsource_work_order.OutsourceWorkOrder",
        _outsource_order_detail,
    ),
    "kuaizhizao:purchase-receipt": ("apps.kuaizhizao.models.purchase_receipt.PurchaseReceipt", _warehouse_doc_detail),
    "kuaizhizao:purchase-return": ("apps.kuaizhizao.models.purchase_return.PurchaseReturn", _warehouse_doc_detail),
    "kuaizhizao:sales-delivery": ("apps.kuaizhizao.models.sales_delivery.SalesDelivery", _warehouse_doc_detail),
    "kuaizhizao:sales-return": ("apps.kuaizhizao.models.sales_return.SalesReturn", _warehouse_doc_detail),
    "kuaizhizao:production-picking": ("apps.kuaizhizao.models.production_picking.ProductionPicking", _warehouse_doc_detail),
    "kuaizhizao:production-return": ("apps.kuaizhizao.models.production_return.ProductionReturn", _warehouse_doc_detail),
    "kuaizhizao:other-inbound": ("apps.kuaizhizao.models.other_inbound.OtherInbound", _warehouse_doc_detail),
    "kuaizhizao:other-outbound": ("apps.kuaizhizao.models.other_outbound.OtherOutbound", _warehouse_doc_detail),
    "kuaizhizao:finished-goods-receipt": (
        "apps.kuaizhizao.models.finished_goods_receipt.FinishedGoodsReceipt",
        _warehouse_doc_detail,
    ),
    "kuaizhizao:production-plan": ("apps.kuaizhizao.models.production_plan.ProductionPlan", _warehouse_doc_detail),
    "kuaizhizao:plan-management-rolling-scheduling": (
        "apps.kuaizhizao.models.rolling_schedule_plan.RollingSchedulePlan",
        _rolling_plan_detail,
    ),
    "kuaizhizao:quality-management-incoming-inspection": (
        "apps.kuaizhizao.models.incoming_inspection.IncomingInspection",
        _inspection_detail,
    ),
    "kuaizhizao:quality-management-process-inspection": (
        "apps.kuaizhizao.models.process_inspection.ProcessInspection",
        _inspection_detail,
    ),
    "kuaizhizao:quality-management-finished-goods-inspection": (
        "apps.kuaizhizao.models.finished_goods_inspection.FinishedGoodsInspection",
        _inspection_detail,
    ),
    "kuaizhizao:quality-management-oqc-inspection": (
        "apps.kuaizhizao.models.oqc_inspection.OQCInspection",
        _inspection_detail,
    ),
}


def _import_model(path: str) -> type[Model]:
    module_path, cls_name = path.rsplit(".", 1)
    mod = importlib.import_module(module_path)
    return getattr(mod, cls_name)


async def load_document_detail(
    *,
    tenant_id: int,
    resource_key: str,
    record_id: int,
) -> dict[str, Any] | None:
    key = (resource_key or "").strip().lower()
    entry = _REGISTRY.get(key)
    if entry is None:
        return None
    model_path, loader = entry
    model_cls = _import_model(model_path)
    row = await model_cls.filter(id=record_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
    if row is None:
        return None
    return loader(row)
