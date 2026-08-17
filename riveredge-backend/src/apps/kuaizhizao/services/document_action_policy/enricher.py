"""单据 capabilities enrich（报价单试点）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypeVar

from infra.services.business_config_service import BusinessConfigService

from apps.kuaizhizao.services.document_action_policy.quotation import (
    derive_quotation_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_order import (
    derive_sales_order_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_order_change import (
    derive_sales_order_change_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_contract import (
    derive_sales_contract_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_forecast import (
    derive_sales_forecast_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.shipment_notice import (
    derive_shipment_notice_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_return import (
    derive_sales_return_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.demand_computation import (
    derive_demand_computation_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.demand import (
    derive_demand_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.purchase_requisition import (
    derive_purchase_requisition_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.purchase_inquiry import (
    derive_purchase_inquiry_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.purchase_order import (
    derive_purchase_order_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.purchase_order_change import (
    derive_purchase_order_change_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.receipt_notice import (
    derive_receipt_notice_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.purchase_return import (
    derive_purchase_return_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.work_order import (
    derive_work_order_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.reporting_record import (
    derive_reporting_record_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.exception_process_record import (
    derive_exception_process_record_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.packing_binding import (
    derive_packing_binding_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
    derive_inbound_hub_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
    derive_outbound_hub_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.customer_material_registration import (
    derive_customer_material_registration_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.inventory_alert import (
    derive_inventory_alert_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.replenishment_suggestion import (
    derive_replenishment_suggestion_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
    derive_quality_inspection_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.oqc_inspection import (
    derive_oqc_inspection_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.eight_d_report import (
    derive_eight_d_report_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.nonconforming_ledger import (
    derive_nonconforming_ledger_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.types import (
    QuotationCapabilities,
    SalesContractCapabilities,
    SalesForecastCapabilities,
    ShipmentNoticeCapabilities,
    SalesReturnCapabilities,
    SalesOrderCapabilities,
    SalesOrderChangeCapabilities,
    DemandComputationCapabilities,
    DemandCapabilities,
    PurchaseRequisitionCapabilities,
    PurchaseInquiryCapabilities,
    PurchaseOrderCapabilities,
    PurchaseOrderChangeCapabilities,
    ReceiptNoticeCapabilities,
    PurchaseReturnCapabilities,
    WorkOrderCapabilities,
    ReportingRecordCapabilities,
    ExceptionProcessRecordCapabilities,
    PackingBindingCapabilities,
    InboundHubCapabilities,
    OutboundHubCapabilities,
    CustomerMaterialRegistrationCapabilities,
    InventoryAlertCapabilities,
    ReplenishmentSuggestionCapabilities,
    QualityInspectionCapabilities,
    OQCInspectionCapabilities,
    EightDReportCapabilities,
    NonconformingLedgerCapabilities,
)

from core.services.approval.audit_capability_gate import gate_audit_allowed_actions

T = TypeVar("T")


def _attach_capabilities_to_response(response: T, caps: Any) -> T:
    """写入 capabilities，并按 capabilities 裁剪 audit.allowed_actions。"""
    audit = getattr(response, "audit", None)
    if audit is None and isinstance(response, dict):
        audit = response.get("audit")
    gated_audit = gate_audit_allowed_actions(audit, caps)
    updates: dict = {"capabilities": caps}
    if gated_audit is not None:
        updates["audit"] = gated_audit
    if hasattr(response, "model_copy"):
        return response.model_copy(update=updates)
    return response


async def batch_document_item_counts(
    tenant_id: int,
    item_model: Any,
    parent_field: str,
    parent_ids: List[int],
) -> Dict[int, int]:
    """批量统计单据明细行数（入库/出库 Hub 列表 total_items）。"""
    if not parent_ids:
        return {}
    from tortoise.functions import Count

    rows = await (
        item_model.filter(tenant_id=tenant_id, **{f"{parent_field}__in": parent_ids})
        .group_by(parent_field)
        .annotate(c=Count("id"))
        .values(parent_field, "c")
    )
    return {int(row[parent_field]): int(row["c"] or 0) for row in rows}


def enrich_inbound_hub_list_capabilities(
    records: List[Any],
    responses: List[T],
    receipt_type: str,
    *,
    item_counts: Optional[Dict[int, int]] = None,
) -> List[T]:
    out: List[T] = []
    for record, resp in zip(records, responses):
        caps = derive_inbound_hub_capabilities(record, receipt_type=receipt_type)
        update: Dict[str, Any] = {"capabilities": caps}
        if item_counts is not None:
            rid = int(getattr(record, "id", 0) or 0)
            update["total_items"] = item_counts.get(rid, 0)
        if hasattr(resp, "model_copy"):
            out.append(resp.model_copy(update=update))
        else:
            out.append(resp)
    return out


async def _quotation_audit_required(tenant_id: int) -> bool:
    return await BusinessConfigService().check_audit_required(tenant_id, "quotation")


async def enrich_quotation_capabilities_on_model(
    tenant_id: int,
    quotation_model: Any,
    response: T,
    *,
    conversion_downstream_missing: bool = False,
    contract_downstream_missing: bool = False,
    sales_review_downstream_missing: bool = False,
) -> T:
    audit_required = await _quotation_audit_required(tenant_id)
    caps = derive_quotation_capabilities(
        quotation_model,
        audit_required=audit_required,
        conversion_downstream_missing=conversion_downstream_missing,
        contract_downstream_missing=contract_downstream_missing,
        sales_review_downstream_missing=sales_review_downstream_missing,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


async def enrich_quotation_list_capabilities(
    tenant_id: int,
    quotations: List[Any],
    responses: List[T],
    *,
    conversion_downstream_missing_by_id: Optional[dict[int, bool]] = None,
    contract_downstream_missing_by_id: Optional[dict[int, bool]] = None,
    sales_review_downstream_missing_by_id: Optional[dict[int, bool]] = None,
) -> List[T]:
    audit_required = await _quotation_audit_required(tenant_id)
    missing_map = conversion_downstream_missing_by_id or {}
    contract_missing_map = contract_downstream_missing_by_id or {}
    review_missing_map = sales_review_downstream_missing_by_id or {}
    out: List[T] = []
    for q_model, resp in zip(quotations, responses):
        qid = int(getattr(q_model, "id", 0) or 0)
        caps = derive_quotation_capabilities(
            q_model,
            audit_required=audit_required,
            conversion_downstream_missing=missing_map.get(qid, False),
            contract_downstream_missing=contract_missing_map.get(qid, False),
            sales_review_downstream_missing=review_missing_map.get(qid, False),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def get_quotation_capabilities_from_record(
    quotation: Any,
    *,
    audit_required: bool,
    conversion_downstream_missing: bool = False,
    contract_downstream_missing: bool = False,
    sales_review_downstream_missing: bool = False,
) -> QuotationCapabilities:
    return derive_quotation_capabilities(
        quotation,
        audit_required=audit_required,
        conversion_downstream_missing=conversion_downstream_missing,
        contract_downstream_missing=contract_downstream_missing,
        sales_review_downstream_missing=sales_review_downstream_missing,
    )


def enrich_sales_order_capabilities_on_response(
    order_model: Any,
    response: T,
    *,
    pushed_to_computation: bool = False,
    has_items: bool = True,
    has_line_work_orders: bool = False,
    computation_pushed_blocks_withdraw: bool = False,
    has_returnable_qty: bool = False,
    has_pushable_qty: bool = False,
) -> T:
    caps = derive_sales_order_capabilities(
        order_model,
        pushed_to_computation=pushed_to_computation,
        has_items=has_items,
        has_line_work_orders=has_line_work_orders,
        computation_pushed_blocks_withdraw=computation_pushed_blocks_withdraw,
        has_returnable_qty=has_returnable_qty,
        has_pushable_qty=has_pushable_qty,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_sales_order_list_capabilities(
    orders: List[Any],
    responses: List[T],
    *,
    pushed_to_computation_by_id: Optional[dict[int, bool]] = None,
    has_items_by_id: Optional[dict[int, bool]] = None,
    has_line_work_orders_by_id: Optional[dict[int, bool]] = None,
    computation_blocks_withdraw_by_id: Optional[dict[int, bool]] = None,
    has_returnable_qty_by_id: Optional[dict[int, bool]] = None,
    has_pushable_qty_by_id: Optional[dict[int, bool]] = None,
) -> List[T]:
    pushed_map = pushed_to_computation_by_id or {}
    items_map = has_items_by_id or {}
    wo_map = has_line_work_orders_by_id or {}
    blocks_map = computation_blocks_withdraw_by_id or {}
    returnable_map = has_returnable_qty_by_id or {}
    pushable_map = has_pushable_qty_by_id or {}
    out: List[T] = []
    for order_model, resp in zip(orders, responses):
        oid = int(getattr(order_model, "id", 0) or 0)
        caps = derive_sales_order_capabilities(
            order_model,
            pushed_to_computation=pushed_map.get(oid, False),
            has_items=items_map.get(oid, True),
            has_line_work_orders=wo_map.get(oid, False),
            computation_pushed_blocks_withdraw=blocks_map.get(oid, False),
            has_returnable_qty=returnable_map.get(oid, False),
            has_pushable_qty=pushable_map.get(oid, False),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def get_sales_order_capabilities_from_record(
    order: Any,
    *,
    pushed_to_computation: bool = False,
    has_items: bool = True,
    has_line_work_orders: bool = False,
    computation_pushed_blocks_withdraw: bool = False,
    has_returnable_qty: bool = False,
    has_pushable_qty: bool = False,
) -> SalesOrderCapabilities:
    return derive_sales_order_capabilities(
        order,
        pushed_to_computation=pushed_to_computation,
        has_items=has_items,
        has_line_work_orders=has_line_work_orders,
        computation_pushed_blocks_withdraw=computation_pushed_blocks_withdraw,
        has_returnable_qty=has_returnable_qty,
        has_pushable_qty=has_pushable_qty,
    )


def enrich_sales_order_change_capabilities_on_response(
    doc: Any,
    response: T,
    *,
    has_change_content: bool = True,
) -> T:
    caps = derive_sales_order_change_capabilities(doc, has_change_content=has_change_content)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_sales_contract_capabilities_on_response(
    contract: Any,
    response: T,
    *,
    has_items: bool = True,
    has_releasable_items: bool = False,
    remaining_amount: Optional[Any] = None,
) -> T:
    caps = derive_sales_contract_capabilities(
        contract,
        has_items=has_items,
        has_releasable_items=has_releasable_items,
        remaining_amount=remaining_amount,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def get_sales_order_change_capabilities_from_record(
    doc: Any,
    *,
    has_change_content: bool = True,
) -> SalesOrderChangeCapabilities:
    return derive_sales_order_change_capabilities(doc, has_change_content=has_change_content)


def get_sales_contract_capabilities_from_record(
    contract: Any,
    *,
    has_items: bool = True,
    has_releasable_items: bool = False,
    remaining_amount: Optional[Any] = None,
) -> SalesContractCapabilities:
    return derive_sales_contract_capabilities(
        contract,
        has_items=has_items,
        has_releasable_items=has_releasable_items,
        remaining_amount=remaining_amount,
    )


def enrich_sales_forecast_capabilities_on_response(
    forecast: Any,
    response: T,
    *,
    pushed_to_computation: bool = False,
    has_downstream: bool = False,
    has_items: bool = True,
) -> T:
    caps = derive_sales_forecast_capabilities(
        forecast,
        pushed_to_computation=pushed_to_computation,
        has_downstream=has_downstream,
        has_items=has_items,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_sales_forecast_list_capabilities(
    forecasts: List[Any],
    responses: List[T],
    *,
    pushed_by_id: Optional[dict[int, bool]] = None,
    downstream_by_id: Optional[dict[int, bool]] = None,
    has_items_by_id: Optional[dict[int, bool]] = None,
) -> List[T]:
    pushed_map = pushed_by_id or {}
    downstream_map = downstream_by_id or {}
    items_map = has_items_by_id or {}
    out: List[T] = []
    for forecast_model, resp in zip(forecasts, responses):
        fid = int(getattr(forecast_model, "id", 0) or 0)
        caps = derive_sales_forecast_capabilities(
            forecast_model,
            pushed_to_computation=pushed_map.get(fid, False),
            has_downstream=downstream_map.get(fid, False),
            has_items=items_map.get(fid, True),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def get_sales_forecast_capabilities_from_record(
    forecast: Any,
    *,
    pushed_to_computation: bool = False,
    has_downstream: bool = False,
    has_items: bool = True,
) -> SalesForecastCapabilities:
    return derive_sales_forecast_capabilities(
        forecast,
        pushed_to_computation=pushed_to_computation,
        has_downstream=has_downstream,
        has_items=has_items,
    )


def enrich_shipment_notice_capabilities_on_response(
    notice: Any,
    response: T,
    *,
    has_items: bool = True,
    has_warehouse: bool = True,
    delivery_withdrawable: bool = True,
) -> T:
    caps = derive_shipment_notice_capabilities(
        notice,
        has_items=has_items,
        has_warehouse=has_warehouse,
        delivery_withdrawable=delivery_withdrawable,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_shipment_notice_list_capabilities(
    notices: List[Any],
    responses: List[T],
    *,
    has_items_by_id: Optional[dict[int, bool]] = None,
    delivery_withdrawable_by_id: Optional[dict[int, bool]] = None,
) -> List[T]:
    items_map = has_items_by_id or {}
    withdraw_map = delivery_withdrawable_by_id or {}
    out: List[T] = []
    for notice_model, resp in zip(notices, responses):
        nid = int(getattr(notice_model, "id", 0) or 0)
        wh_id = getattr(notice_model, "warehouse_id", None)
        caps = derive_shipment_notice_capabilities(
            notice_model,
            has_items=items_map.get(nid, True),
            has_warehouse=wh_id is not None,
            delivery_withdrawable=withdraw_map.get(nid, True),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def get_shipment_notice_capabilities_from_record(
    notice: Any,
    *,
    has_items: bool = True,
    has_warehouse: bool = True,
    delivery_withdrawable: bool = True,
) -> ShipmentNoticeCapabilities:
    return derive_shipment_notice_capabilities(
        notice,
        has_items=has_items,
        has_warehouse=has_warehouse,
        delivery_withdrawable=delivery_withdrawable,
    )


def enrich_sales_return_capabilities_on_response(
    return_doc: Any,
    response: T,
    *,
    has_items: bool = True,
    audit_required: bool = False,
) -> T:
    caps = derive_sales_return_capabilities(
        return_doc,
        has_items=has_items,
        audit_required=audit_required,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_sales_return_list_capabilities(
    return_docs: List[Any],
    responses: List[T],
    *,
    has_items_by_id: Optional[dict[int, bool]] = None,
    item_counts_by_id: Optional[dict[int, int]] = None,
    audit_required: bool = False,
) -> List[T]:
    items_map = has_items_by_id or {}
    out: List[T] = []
    for doc, resp in zip(return_docs, responses):
        rid = int(getattr(doc, "id", 0) or 0)
        caps = derive_sales_return_capabilities(
            doc,
            has_items=items_map.get(rid, True),
            audit_required=audit_required,
        )
        update: Dict[str, Any] = {"capabilities": caps}
        if item_counts_by_id is not None:
            update["total_items"] = item_counts_by_id.get(rid, 0)
        if hasattr(resp, "model_copy"):
            out.append(resp.model_copy(update=update))
        else:
            out.append(resp)
    return out


def get_sales_return_capabilities_from_record(
    return_doc: Any,
    *,
    has_items: bool = True,
) -> SalesReturnCapabilities:
    return derive_sales_return_capabilities(return_doc, has_items=has_items)


def enrich_demand_computation_capabilities_on_response(
    computation: Any,
    response: T,
) -> T:
    caps = derive_demand_computation_capabilities(computation)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_demand_computation_list_capabilities(
    computations: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for comp_model, resp in zip(computations, responses):
        caps = derive_demand_computation_capabilities(comp_model)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_demand_capabilities_on_response(demand: Any, response: T) -> T:
    caps = derive_demand_capabilities(demand)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_demand_list_capabilities(
    demands: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for demand_model, resp in zip(demands, responses):
        caps = derive_demand_capabilities(demand_model)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


async def purchase_requisition_linked_po_by_ids(
    tenant_id: int,
    requisition_ids: List[int],
) -> Dict[int, bool]:
    """批量判定采购申请是否已有明细转采购订单（行上 PO 或下游反查）。"""
    ids = [int(rid) for rid in requisition_ids if rid]
    if not ids:
        return {}
    from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisitionItem
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

    linked: Dict[int, bool] = {rid: False for rid in ids}
    items = await PurchaseRequisitionItem.filter(
        tenant_id=tenant_id,
        requisition_id__in=ids,
    ).all()
    item_to_req: Dict[int, int] = {}
    unchecked_item_ids: List[int] = []
    for it in items:
        rid = int(it.requisition_id)
        iid = int(it.id)
        item_to_req[iid] = rid
        if it.purchase_order_id:
            linked[rid] = True
        else:
            unchecked_item_ids.append(iid)
    if unchecked_item_ids:
        linked_sources = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            source_type="PurchaseRequisition",
            source_id__in=unchecked_item_ids,
            deleted_at__isnull=True,
        ).values_list("source_id", flat=True)
        for source_id in linked_sources:
            rid = item_to_req.get(int(source_id))
            if rid is not None:
                linked[rid] = True
    return linked


async def purchase_requisition_has_linked_purchase_order(
    tenant_id: int,
    requisition_id: int,
) -> bool:
    linked = await purchase_requisition_linked_po_by_ids(tenant_id, [int(requisition_id)])
    return bool(linked.get(int(requisition_id), False))


def enrich_purchase_requisition_capabilities_on_response(
    req: Any,
    response: T,
    *,
    has_linked_purchase_order: bool = False,
) -> T:
    caps = derive_purchase_requisition_capabilities(
        req,
        has_linked_purchase_order=has_linked_purchase_order,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


async def enrich_purchase_requisition_detail_capabilities(
    tenant_id: int,
    req: Any,
    response: T,
) -> T:
    has_linked = await purchase_requisition_has_linked_purchase_order(
        tenant_id, int(req.id)
    )
    return enrich_purchase_requisition_capabilities_on_response(
        req,
        response,
        has_linked_purchase_order=has_linked,
    )


async def enrich_purchase_requisition_list_capabilities(
    tenant_id: int,
    reqs: List[Any],
    responses: List[T],
) -> List[T]:
    req_ids = [int(getattr(r, "id", 0) or 0) for r in reqs]
    linked_map = await purchase_requisition_linked_po_by_ids(tenant_id, req_ids)
    out: List[T] = []
    for req_model, resp in zip(reqs, responses):
        rid = int(getattr(req_model, "id", 0) or 0)
        caps = derive_purchase_requisition_capabilities(
            req_model,
            has_linked_purchase_order=linked_map.get(rid, False),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_purchase_inquiry_capabilities_on_response(inquiry: Any, response: T) -> T:
    caps = derive_purchase_inquiry_capabilities(inquiry)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_purchase_inquiry_list_capabilities(
    inquiries: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for inquiry_model, resp in zip(inquiries, responses):
        caps = derive_purchase_inquiry_capabilities(inquiry_model)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


async def _purchase_order_has_outstanding(tenant_id: int, order_id: int) -> bool:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem, effective_po_item_outstanding

    items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
    return any(float(effective_po_item_outstanding(i)) > 0 for i in items)


async def _purchase_order_outstanding_by_ids(tenant_id: int, order_ids: List[int]) -> dict[int, bool]:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem, effective_po_item_outstanding

    if not order_ids:
        return {}
    items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id__in=order_ids).all()
    result: dict[int, bool] = {oid: False for oid in order_ids}
    for item in items:
        if float(effective_po_item_outstanding(item)) > 0:
            result[int(item.order_id)] = True
    return result


async def _purchase_order_pushable_receipt_outstanding_by_ids(
    tenant_id: int, order_ids: List[int]
) -> dict[int, bool]:
    """任意订单行存在可下推入库余量（未入库 - 未完成入库单占用）。"""
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem, effective_po_item_outstanding
    from apps.kuaizhizao.services.warehouse_service import occupied_purchase_receipt_qty_by_po_item_ids

    if not order_ids:
        return {}
    items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id__in=order_ids).all()
    occupied_by_item = await occupied_purchase_receipt_qty_by_po_item_ids(tenant_id, order_ids)
    result: dict[int, bool] = {oid: False for oid in order_ids}
    for item in items:
        outstanding = float(effective_po_item_outstanding(item))
        if outstanding <= 0:
            continue
        occupied = float(occupied_by_item.get(int(item.id), 0))
        if outstanding - occupied > 0:
            result[int(item.order_id)] = True
    return result


async def _purchase_order_pushable_notice_outstanding_by_ids(
    tenant_id: int, order_ids: List[int]
) -> dict[int, bool]:
    """任意订单行存在可下推收货通知余量（min(未入库, 订购-已通知) > 0）。"""
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem, effective_po_item_outstanding
    from apps.kuaizhizao.services.warehouse_service import noticed_qty_by_po_item_ids

    if not order_ids:
        return {}
    items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id__in=order_ids).all()
    noticed_by_item = await noticed_qty_by_po_item_ids(tenant_id, order_ids)
    result: dict[int, bool] = {oid: False for oid in order_ids}
    for item in items:
        outstanding = float(effective_po_item_outstanding(item))
        if outstanding <= 0:
            continue
        ordered = float(item.ordered_quantity or 0)
        noticed = float(noticed_by_item.get(int(item.id), 0))
        max_push = min(outstanding, max(0.0, ordered - noticed))
        if max_push > 0:
            result[int(item.order_id)] = True
    return result


async def _purchase_order_received_by_ids(tenant_id: int, order_ids: List[int]) -> dict[int, bool]:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

    if not order_ids:
        return {}
    items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id__in=order_ids).all()
    result: dict[int, bool] = {oid: False for oid in order_ids}
    for item in items:
        if float(item.received_quantity or 0) > 0:
            result[int(item.order_id)] = True
    return result


async def _purchase_order_receipt_notice_by_ids(tenant_id: int, order_ids: List[int]) -> dict[int, bool]:
    from apps.kuaizhizao.models.receipt_notice import ReceiptNotice

    if not order_ids:
        return {}
    result: dict[int, bool] = {oid: False for oid in order_ids}
    notice_order_ids = await ReceiptNotice.filter(
        tenant_id=tenant_id,
        purchase_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values_list("purchase_order_id", flat=True)
    for oid in notice_order_ids:
        result[int(oid)] = True
    return result


async def _purchase_order_invoice_by_ids(tenant_id: int, order_ids: List[int]) -> dict[int, bool]:
    from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice

    if not order_ids:
        return {}
    result: dict[int, bool] = {oid: False for oid in order_ids}
    invoice_order_ids = await PurchaseInvoice.filter(
        tenant_id=tenant_id,
        purchase_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values_list("purchase_order_id", flat=True)
    for oid in invoice_order_ids:
        result[int(oid)] = True
    return result


async def _purchase_order_returnable_by_ids(tenant_id: int, order_ids: List[int]) -> dict[int, bool]:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
    from apps.kuaizhizao.services.warehouse_service import returned_qty_by_purchase_order_item_ids

    if not order_ids:
        return {}
    result: dict[int, bool] = {oid: False for oid in order_ids}
    items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id__in=order_ids).all()
    received_by_order: dict[int, list] = {}
    for item in items:
        if float(item.received_quantity or 0) <= 0:
            continue
        received_by_order.setdefault(int(item.order_id), []).append(item)

    returned_by_item = await returned_qty_by_purchase_order_item_ids(
        tenant_id,
        [int(item.id) for item in items],
    )

    for oid, order_items in received_by_order.items():
        for item in order_items:
            received = float(item.received_quantity or 0)
            returned = returned_by_item.get(int(item.id), 0.0)
            if max(0.0, received - returned) > 0:
                result[oid] = True
                break
    return result


async def _purchase_order_pending_change_by_ids(tenant_id: int, order_ids: List[int]) -> dict[int, bool]:
    from apps.kuaizhizao.constants import DocumentStatus
    from apps.kuaizhizao.models.purchase_order_change_order import PurchaseOrderChangeOrder

    if not order_ids:
        return {}
    result: dict[int, bool] = {oid: False for oid in order_ids}
    pending_ids = await PurchaseOrderChangeOrder.filter(
        tenant_id=tenant_id,
        source_order_id__in=order_ids,
        deleted_at__isnull=True,
        status__in=[
            DocumentStatus.DRAFT.value,
            DocumentStatus.PENDING_REVIEW.value,
            DocumentStatus.AUDITED.value,
        ],
    ).values_list("source_order_id", flat=True)
    for oid in pending_ids:
        result[int(oid)] = True
    return result


async def _purchase_order_downstream_by_ids(tenant_id: int, order_ids: List[int]) -> dict[int, bool]:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
    from apps.kuaizhizao.models.purchase_order_change_order import PurchaseOrderChangeOrder
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.models.purchase_return import PurchaseReturn
    from apps.kuaizhizao.models.receipt_notice import ReceiptNotice

    if not order_ids:
        return {}
    result: dict[int, bool] = {oid: False for oid in order_ids}

    def _mark(order_id: int) -> None:
        result[int(order_id)] = True

    items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id__in=order_ids).all()
    for item in items:
        if float(item.received_quantity or 0) > 0:
            _mark(int(item.order_id))

    notice_ids = await ReceiptNotice.filter(
        tenant_id=tenant_id,
        purchase_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values_list("purchase_order_id", flat=True)
    for oid in notice_ids:
        _mark(int(oid))

    receipt_ids = await PurchaseReceipt.filter(
        tenant_id=tenant_id,
        purchase_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values_list("purchase_order_id", flat=True)
    for oid in receipt_ids:
        _mark(int(oid))

    return_ids = await PurchaseReturn.filter(
        tenant_id=tenant_id,
        purchase_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values_list("purchase_order_id", flat=True)
    for oid in return_ids:
        _mark(int(oid))

    change_ids = await PurchaseOrderChangeOrder.filter(
        tenant_id=tenant_id,
        source_order_id__in=order_ids,
        deleted_at__isnull=True,
    ).values_list("source_order_id", flat=True)
    for oid in change_ids:
        _mark(int(oid))

    return result


async def purchase_order_has_downstream(tenant_id: int, order_id: int) -> bool:
    downstream_map = await _purchase_order_downstream_by_ids(tenant_id, [order_id])
    return downstream_map.get(order_id, False)


def enrich_purchase_order_capabilities_on_response(
    order: Any,
    response: T,
    *,
    has_items: bool = True,
    has_outstanding: bool = False,
    has_pushable_receipt_outstanding: bool = False,
    has_pushable_notice_outstanding: bool = False,
    has_received: bool = False,
    has_invoice: bool = False,
    has_receipt_notice: bool = False,
    has_downstream: bool = False,
    has_pending_change: bool = False,
    has_returnable: bool = False,
) -> T:
    caps = derive_purchase_order_capabilities(
        order,
        has_items=has_items,
        has_outstanding=has_outstanding,
        has_pushable_receipt_outstanding=has_pushable_receipt_outstanding,
        has_pushable_notice_outstanding=has_pushable_notice_outstanding,
        has_received=has_received,
        has_invoice=has_invoice,
        has_receipt_notice=has_receipt_notice,
        has_downstream=has_downstream,
        has_pending_change=has_pending_change,
        has_returnable=has_returnable,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


async def enrich_purchase_order_detail_capabilities(
    tenant_id: int,
    order: Any,
    response: T,
    *,
    has_items: bool = True,
) -> T:
    order_id = int(order.id)
    has_outstanding = await _purchase_order_has_outstanding(tenant_id, order_id)
    pushable_receipt_map = await _purchase_order_pushable_receipt_outstanding_by_ids(
        tenant_id, [order_id]
    )
    pushable_notice_map = await _purchase_order_pushable_notice_outstanding_by_ids(
        tenant_id, [order_id]
    )
    has_received_map = await _purchase_order_received_by_ids(tenant_id, [order_id])
    has_invoice_map = await _purchase_order_invoice_by_ids(tenant_id, [order_id])
    has_downstream = await purchase_order_has_downstream(tenant_id, order_id)
    pending_change_map = await _purchase_order_pending_change_by_ids(tenant_id, [order_id])
    returnable_map = await _purchase_order_returnable_by_ids(tenant_id, [order_id])
    return enrich_purchase_order_capabilities_on_response(
        order,
        response,
        has_items=has_items,
        has_outstanding=has_outstanding,
        has_pushable_receipt_outstanding=pushable_receipt_map.get(order_id, False),
        has_pushable_notice_outstanding=pushable_notice_map.get(order_id, False),
        has_received=has_received_map.get(order_id, False),
        has_invoice=has_invoice_map.get(order_id, False),
        has_downstream=has_downstream,
        has_pending_change=pending_change_map.get(order_id, False),
        has_returnable=returnable_map.get(order_id, False),
    )


async def enrich_purchase_order_list_capabilities(
    tenant_id: int,
    orders: List[Any],
    responses: List[T],
    *,
    has_items_by_id: Optional[dict[int, bool]] = None,
) -> List[T]:
    order_ids = [int(getattr(o, "id", 0) or 0) for o in orders]
    outstanding_map = await _purchase_order_outstanding_by_ids(tenant_id, order_ids)
    pushable_receipt_map = await _purchase_order_pushable_receipt_outstanding_by_ids(
        tenant_id, order_ids
    )
    pushable_notice_map = await _purchase_order_pushable_notice_outstanding_by_ids(
        tenant_id, order_ids
    )
    received_map = await _purchase_order_received_by_ids(tenant_id, order_ids)
    invoice_map = await _purchase_order_invoice_by_ids(tenant_id, order_ids)
    downstream_map = await _purchase_order_downstream_by_ids(tenant_id, order_ids)
    pending_change_map = await _purchase_order_pending_change_by_ids(tenant_id, order_ids)
    returnable_map = await _purchase_order_returnable_by_ids(tenant_id, order_ids)
    items_map = has_items_by_id or {}
    out: List[T] = []
    for order_model, resp in zip(orders, responses):
        oid = int(getattr(order_model, "id", 0) or 0)
        caps = derive_purchase_order_capabilities(
            order_model,
            has_items=items_map.get(oid, True),
            has_outstanding=outstanding_map.get(oid, False),
            has_pushable_receipt_outstanding=pushable_receipt_map.get(oid, False),
            has_pushable_notice_outstanding=pushable_notice_map.get(oid, False),
            has_received=received_map.get(oid, False),
            has_invoice=invoice_map.get(oid, False),
            has_downstream=downstream_map.get(oid, False),
            has_pending_change=pending_change_map.get(oid, False),
            has_returnable=returnable_map.get(oid, False),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_purchase_order_change_capabilities_on_response(
    doc: Any,
    response: T,
    *,
    has_change_content: bool = True,
) -> T:
    caps = derive_purchase_order_change_capabilities(doc, has_change_content=has_change_content)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_receipt_notice_capabilities_on_response(
    notice: Any,
    response: T,
    *,
    has_items: bool = True,
    has_warehouse: bool = True,
    receipt_withdrawable: bool = True,
) -> T:
    caps = derive_receipt_notice_capabilities(
        notice,
        has_items=has_items,
        has_warehouse=has_warehouse,
        receipt_withdrawable=receipt_withdrawable,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_receipt_notice_list_capabilities(
    notices: List[Any],
    responses: List[T],
    *,
    has_items_by_id: Optional[dict[int, bool]] = None,
    receipt_withdrawable_by_id: Optional[dict[int, bool]] = None,
) -> List[T]:
    items_map = has_items_by_id or {}
    withdraw_map = receipt_withdrawable_by_id or {}
    out: List[T] = []
    for notice_model, resp in zip(notices, responses):
        nid = int(getattr(notice_model, "id", 0) or 0)
        wh_id = getattr(notice_model, "warehouse_id", None)
        caps = derive_receipt_notice_capabilities(
            notice_model,
            has_items=items_map.get(nid, True),
            has_warehouse=wh_id is not None,
            receipt_withdrawable=withdraw_map.get(nid, True),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_purchase_return_capabilities_on_response(
    return_doc: Any,
    response: T,
    *,
    has_items: bool = True,
    audit_required: bool = False,
) -> T:
    caps = derive_purchase_return_capabilities(
        return_doc,
        has_items=has_items,
        audit_required=audit_required,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_purchase_return_list_capabilities(
    return_docs: List[Any],
    responses: List[T],
    *,
    has_items_by_id: Optional[dict[int, bool]] = None,
    audit_required: bool = False,
) -> List[T]:
    items_map = has_items_by_id or {}
    out: List[T] = []
    for doc, resp in zip(return_docs, responses):
        rid = int(getattr(doc, "id", 0) or 0)
        caps = derive_purchase_return_capabilities(
            doc,
            has_items=items_map.get(rid, True),
            audit_required=audit_required,
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_work_order_capabilities_on_response(
    wo: Any,
    response: T,
    *,
    has_returnable_picking: bool | None = None,
    has_downstream_documents: bool | None = None,
    audit_required: bool | None = None,
) -> T:
    caps = derive_work_order_capabilities(
        wo,
        has_returnable_picking=has_returnable_picking,
        has_downstream_documents=has_downstream_documents,
        audit_required=audit_required,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_work_order_list_capabilities(
    work_orders: List[Any],
    responses: List[T],
    *,
    has_returnable_picking_by_id: dict[int, bool] | None = None,
    has_downstream_documents_by_id: dict[int, bool] | None = None,
    audit_required: bool | None = None,
) -> List[T]:
    out: List[T] = []
    lookup = has_returnable_picking_by_id or {}
    downstream_lookup = has_downstream_documents_by_id or {}
    for wo, resp in zip(work_orders, responses):
        wo_id = getattr(wo, "id", None)
        has_returnable = lookup.get(int(wo_id)) if wo_id is not None else None
        has_downstream = downstream_lookup.get(int(wo_id)) if wo_id is not None else None
        caps = derive_work_order_capabilities(
            wo,
            has_returnable_picking=has_returnable,
            has_downstream_documents=has_downstream,
            audit_required=audit_required,
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_work_order_list_item_dicts(
    item_dicts: List[dict],
    *,
    has_downstream_documents_by_id: dict[int, bool] | None = None,
) -> List[dict]:
    downstream_lookup = has_downstream_documents_by_id or {}
    for item in item_dicts:
        wo_id = item.get("id")
        has_downstream = downstream_lookup.get(int(wo_id)) if wo_id is not None else None
        caps = derive_work_order_capabilities(item, has_downstream_documents=has_downstream)
        item["capabilities"] = caps
    return item_dicts


def enrich_reporting_record_capabilities_on_response(record: Any, response: T) -> T:
    caps = derive_reporting_record_capabilities(record)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_reporting_record_list_capabilities(
    records: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for record, resp in zip(records, responses):
        caps = derive_reporting_record_capabilities(record)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_exception_process_record_capabilities_on_response(record: Any, response: T) -> T:
    caps = derive_exception_process_record_capabilities(record)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_exception_process_record_list_capabilities(
    records: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for record, resp in zip(records, responses):
        caps = derive_exception_process_record_capabilities(record)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_packing_binding_capabilities_on_response(binding: Any, response: T) -> T:
    caps = derive_packing_binding_capabilities(binding)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_packing_binding_list_capabilities(
    bindings: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for binding, resp in zip(bindings, responses):
        caps = derive_packing_binding_capabilities(binding)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_outbound_hub_list_capabilities(
    records: List[Any],
    responses: List[T],
    outbound_type: str,
    *,
    item_counts: Optional[Dict[int, int]] = None,
    audit_required: bool = False,
) -> List[T]:
    out: List[T] = []
    for record, resp in zip(records, responses):
        caps = derive_outbound_hub_capabilities(
            record, outbound_type=outbound_type, audit_required=audit_required
        )
        enriched = _attach_capabilities_to_response(resp, caps) if hasattr(resp, "model_copy") else resp
        if item_counts is not None and hasattr(enriched, "model_copy"):
            rid = int(getattr(record, "id", 0) or 0)
            enriched = enriched.model_copy(update={"total_items": item_counts.get(rid, 0)})
        out.append(enriched)
    return out


def enrich_outsource_work_order_list_capabilities(
    records: List[Any],
    responses: List[T],
) -> List[T]:
    from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
        derive_outsource_work_order_capabilities,
    )

    out: List[T] = []
    for record, resp in zip(records, responses):
        caps = derive_outsource_work_order_capabilities(record)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_customer_material_registration_capabilities_on_response(
    registration: Any,
    response: T,
) -> T:
    caps = derive_customer_material_registration_capabilities(registration)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_customer_material_registration_list_capabilities(
    registrations: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for registration, resp in zip(registrations, responses):
        caps = derive_customer_material_registration_capabilities(registration)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_inventory_alert_list_capabilities(
    alerts: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for alert, resp in zip(alerts, responses):
        caps = derive_inventory_alert_capabilities(alert)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_replenishment_suggestion_list_capabilities(
    suggestions: List[Any],
    responses: List[T],
    *,
    require_purchase_requisition: bool = False,
) -> List[T]:
    out: List[T] = []
    for suggestion, resp in zip(suggestions, responses):
        caps = derive_replenishment_suggestion_capabilities(
            suggestion,
            require_purchase_requisition=require_purchase_requisition,
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_quality_inspection_capabilities_on_response(
    inspection: Any,
    response: T,
    *,
    supports_purchase_return: bool = False,
    supports_push_rework: bool = False,
    pushed_purchase_return_quantity: float = 0.0,
    pushed_rework_quantity: float = 0.0,
    certificate_issued: bool = False,
) -> T:
    caps = derive_quality_inspection_capabilities(
        inspection,
        supports_purchase_return=supports_purchase_return,
        supports_push_rework=supports_push_rework,
        pushed_purchase_return_quantity=pushed_purchase_return_quantity,
        pushed_rework_quantity=pushed_rework_quantity,
        certificate_issued=certificate_issued,
    )
    if hasattr(response, "model_copy"):
        attached = _attach_capabilities_to_response(response, caps)
        qty_updates: dict = {}
        if supports_purchase_return:
            qty_updates["pushed_purchase_return_quantity"] = float(
                pushed_purchase_return_quantity or 0.0
            )
        if supports_push_rework:
            qty_updates["pushed_rework_quantity"] = float(pushed_rework_quantity or 0.0)
        if qty_updates:
            return attached.model_copy(update=qty_updates)
        return attached
    return response


def enrich_quality_inspection_list_capabilities(
    inspections: List[Any],
    responses: List[T],
    *,
    supports_purchase_return: bool = False,
    supports_push_rework: bool = False,
    pushed_purchase_return_qty_by_inspection_id: Optional[Dict[int, float]] = None,
    pushed_rework_qty_by_inspection_id: Optional[Dict[int, float]] = None,
) -> List[T]:
    pushed_return_map = pushed_purchase_return_qty_by_inspection_id or {}
    pushed_map = pushed_rework_qty_by_inspection_id or {}
    out: List[T] = []
    for inspection, resp in zip(inspections, responses):
        pushed_return_qty = 0.0
        pushed_qty = 0.0
        inspection_id = getattr(inspection, "id", None)
        if inspection_id is not None:
            pushed_return_qty = float(pushed_return_map.get(int(inspection_id), 0.0))
            pushed_qty = float(pushed_map.get(int(inspection_id), 0.0))
        caps = derive_quality_inspection_capabilities(
            inspection,
            supports_purchase_return=supports_purchase_return,
            supports_push_rework=supports_push_rework,
            pushed_purchase_return_quantity=pushed_return_qty,
            pushed_rework_quantity=pushed_qty,
            certificate_issued=bool(getattr(inspection, "certificate_issued", False)),
        )
        if hasattr(resp, "model_copy"):
            attached = _attach_capabilities_to_response(resp, caps)
            qty_updates: dict = {}
            if supports_purchase_return:
                qty_updates["pushed_purchase_return_quantity"] = pushed_return_qty
            if supports_push_rework:
                qty_updates["pushed_rework_quantity"] = pushed_qty
            if qty_updates:
                attached = attached.model_copy(update=qty_updates)
            out.append(attached)
        else:
            out.append(resp)
    return out


def enrich_oqc_inspection_capabilities_on_response(inspection: Any, response: T) -> T:
    caps = derive_oqc_inspection_capabilities(inspection)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_oqc_inspection_list_capabilities(
    inspections: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for inspection, resp in zip(inspections, responses):
        caps = derive_oqc_inspection_capabilities(inspection)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


def enrich_eight_d_report_capabilities_on_response(report: Any, response: T) -> T:
    caps = derive_eight_d_report_capabilities(report)
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


def enrich_eight_d_report_list_capabilities(
    reports: List[Any],
    responses: List[T],
) -> List[T]:
    out: List[T] = []
    for report, resp in zip(reports, responses):
        caps = derive_eight_d_report_capabilities(report)
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out


async def _linked_8d_report_by_defect_ids(
    tenant_id: int,
    defect_ids: List[int],
) -> dict[int, bool]:
    from apps.kuaizhizao.models.quality_8d_report import Quality8DReport

    if not defect_ids:
        return {}
    rows = await Quality8DReport.filter(
        tenant_id=tenant_id,
        defect_record_id__in=defect_ids,
        deleted_at__isnull=True,
    ).values_list("defect_record_id", flat=True)
    linked = {int(did): False for did in defect_ids}
    for defect_id in rows:
        if defect_id is not None:
            linked[int(defect_id)] = True
    return linked


def enrich_nonconforming_ledger_capabilities_on_response(
    record: Any,
    response: T,
    *,
    has_linked_8d_report: bool = False,
) -> T:
    caps = derive_nonconforming_ledger_capabilities(
        record,
        has_linked_8d_report=has_linked_8d_report,
    )
    if hasattr(response, "model_copy"):
        return _attach_capabilities_to_response(response, caps)
    return response


async def enrich_nonconforming_ledger_list_capabilities(
    tenant_id: int,
    records: List[Any],
    responses: List[T],
) -> List[T]:
    defect_ids = [int(getattr(r, "id", 0) or 0) for r in records]
    linked_map = await _linked_8d_report_by_defect_ids(tenant_id, defect_ids)
    out: List[T] = []
    for record, resp in zip(records, responses):
        rid = int(getattr(record, "id", 0) or 0)
        caps = derive_nonconforming_ledger_capabilities(
            record,
            has_linked_8d_report=linked_map.get(rid, False),
        )
        if hasattr(resp, "model_copy"):
            out.append(_attach_capabilities_to_response(resp, caps))
        else:
            out.append(resp)
    return out
