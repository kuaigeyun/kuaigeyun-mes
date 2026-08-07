"""统一审核动作 → 各业务 Service 的分发实现。

与 ``manifest.audit`` 声明的 entity_type 一一对应；未实现的动作用 ``ValidationError`` 显式报错。
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Optional

from infra.exceptions.exceptions import ValidationError

DispatchFn = Callable[..., Awaitable[Any]]


def _unsupported(entity_type: str, action: str) -> None:
    raise ValidationError(f"实体 {entity_type} 不支持审核动作: {action}")


async def _dispatch_sales_order(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.sales_order_service import SalesOrderService

    svc = SalesOrderService()
    if action == "submit":
        return await svc.submit_sales_order(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_sales_order(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.reject_sales_order(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.unapprove_sales_order(tenant_id, entity_id, user_id)
    if action == "withdraw":
        return await svc.withdraw_sales_order(tenant_id, entity_id, user_id)
    _unsupported("sales_order", action)


async def _dispatch_sales_order_change(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.schemas.order_change import ApproveChangeRequest
    from apps.kuaizhizao.services.sales_order_change_service import SalesOrderChangeService

    svc = SalesOrderChangeService()
    if action == "submit":
        return await svc.submit(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve(
            tenant_id, entity_id, ApproveChangeRequest(approved=True, review_remarks=reason), user_id
        )
    if action == "reject":
        return await svc.approve(
            tenant_id,
            entity_id,
            ApproveChangeRequest(approved=False, review_remarks=reason or "审批驳回"),
            user_id,
        )
    if action == "withdraw":
        return await svc.withdraw(tenant_id, entity_id, user_id)
    if action == "revoke":
        _unsupported("sales_order_change", action)
    _unsupported("sales_order_change", action)


async def _dispatch_sales_forecast(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.sales_service import SalesForecastService

    svc = SalesForecastService()
    if action == "submit":
        return await svc.submit_forecast(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_forecast(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_forecast(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.withdraw_forecast_approval(tenant_id, entity_id, user_id)
    if action == "withdraw":
        return await svc.withdraw_forecast(tenant_id, entity_id, user_id)
    _unsupported("sales_forecast", action)


async def _dispatch_sales_contract(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.sales_contract_service import SalesContractService

    svc = SalesContractService()
    reviewer_name = await svc.get_user_name(user_id) or str(user_id)
    if action == "submit":
        return await svc.submit_contract(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_contract(
            tenant_id, entity_id, user_id, reviewer_name, review_remarks=reason
        )
    if action == "reject":
        return await svc.reject_contract(
            tenant_id, entity_id, user_id, reviewer_name, review_remarks=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_contract(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.revoke_contract_approval(tenant_id, entity_id, user_id)
    _unsupported("sales_contract", action)


async def _dispatch_quotation(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.quotation_service import QuotationService

    svc = QuotationService()
    if action == "submit":
        return await svc.submit_quotation(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_quotation(tenant_id, entity_id, user_id, review_remarks=reason)
    if action == "reject":
        return await svc.reject_quotation(
            tenant_id, entity_id, user_id, review_remarks=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_quotation(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.revoke_review_quotation(tenant_id, entity_id, user_id)
    _unsupported("quotation", action)


async def _dispatch_shipment_notice(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.shipment_notice_service import ShipmentNoticeService

    svc = ShipmentNoticeService()
    if action == "submit":
        return await svc.submit_shipment_notice(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_shipment_notice(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.reject_shipment_notice(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_shipment_notice_submit(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.revoke_shipment_notice_approval(tenant_id, entity_id, user_id)
    _unsupported("shipment_notice", action)


async def _dispatch_sales_delivery(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService

    svc = SalesDeliveryService()
    if action == "submit":
        return await svc.submit_sales_delivery(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_sales_delivery(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.reject_sales_delivery(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_sales_delivery_submit(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.revoke_sales_delivery_approval(tenant_id, entity_id, user_id)
    _unsupported("sales_delivery", action)


async def _dispatch_sales_return(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.warehouse_service import SalesReturnService

    svc = SalesReturnService()
    if action == "submit":
        return await svc.submit_sales_return(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_sales_return(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.reject_sales_return(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_sales_return_submit(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.revoke_sales_return_approval(tenant_id, entity_id, user_id)
    _unsupported("sales_return", action)


async def _dispatch_sales_contract_change(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.sales_contract_service import SalesContractService

    svc = SalesContractService()
    if action == "submit":
        return await svc.submit_contract_change(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_contract_change(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.reject_contract_change(
            tenant_id, entity_id, user_id, review_remarks=reason or "审批驳回"
        )
    if action == "withdraw":
        _unsupported("sales_contract_change", action)
    if action == "revoke":
        _unsupported("sales_contract_change", action)
    _unsupported("sales_contract_change", action)


async def _dispatch_demand(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.demand_service import DemandService

    svc = DemandService()
    if action == "submit":
        return await svc.submit_demand(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_demand(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_demand(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_demand(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.unapprove_demand(tenant_id, entity_id, user_id)
    _unsupported("demand", action)


async def _dispatch_purchase_order(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.schemas.purchase import PurchaseOrderApprove
    from apps.kuaizhizao.services.purchase_service import PurchaseService

    svc = PurchaseService()
    if action == "submit":
        return await svc.submit_purchase_order(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_purchase_order(
            tenant_id,
            entity_id,
            PurchaseOrderApprove(approved=True, review_remarks=reason),
            user_id,
        )
    if action == "reject":
        return await svc.approve_purchase_order(
            tenant_id,
            entity_id,
            PurchaseOrderApprove(approved=False, review_remarks=reason or "审批驳回"),
            user_id,
        )
    if action == "withdraw":
        return await svc.withdraw_purchase_order(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.revoke_purchase_order_approval(tenant_id, entity_id, user_id)
    _unsupported("purchase_order", action)


async def _dispatch_purchase_order_change(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.schemas.order_change import ApproveChangeRequest
    from apps.kuaizhizao.services.purchase_order_change_service import PurchaseOrderChangeService

    svc = PurchaseOrderChangeService()
    if action == "submit":
        return await svc.submit(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve(
            tenant_id, entity_id, ApproveChangeRequest(approved=True, review_remarks=reason), user_id
        )
    if action == "reject":
        return await svc.approve(
            tenant_id,
            entity_id,
            ApproveChangeRequest(approved=False, review_remarks=reason or "审批驳回"),
            user_id,
        )
    if action == "withdraw":
        return await svc.withdraw(tenant_id, entity_id, user_id)
    if action == "revoke":
        _unsupported("purchase_order_change", action)
    _unsupported("purchase_order_change", action)


async def _dispatch_purchase_request(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService

    svc = PurchaseRequisitionService()
    if action == "submit":
        return await svc.submit_requisition(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_requisition(
            tenant_id, entity_id, True, review_remarks=reason, approved_by=user_id
        )
    if action == "reject":
        return await svc.approve_requisition(
            tenant_id, entity_id, False, review_remarks=reason or "审批驳回", approved_by=user_id
        )
    if action == "revoke":
        return await svc.withdraw_approval(tenant_id, entity_id, operator_id=user_id)
    if action == "withdraw":
        return await svc.withdraw_requisition(tenant_id, entity_id, user_id)
    _unsupported("purchase_request", action)


async def _dispatch_purchase_inquiry(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.purchase_inquiry_service import PurchaseInquiryService

    svc = PurchaseInquiryService()
    if action == "submit":
        return await svc.submit_inquiry(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_inquiry(tenant_id, entity_id, True, user_id, remarks=reason)
    if action == "reject":
        return await svc.approve_inquiry(
            tenant_id, entity_id, False, user_id, remarks=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.withdraw_approval(tenant_id, entity_id, user_id)
    if action == "withdraw":
        return await svc.withdraw_inquiry(tenant_id, entity_id, user_id)
    _unsupported("purchase_inquiry", action)


async def _dispatch_reporting_record(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.reporting_service import ReportingService

    svc = ReportingService()
    if action == "approve":
        return await svc.approve_reporting_record(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_reporting_record(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.revoke_reporting_approval(tenant_id, entity_id, user_id)
    if action in ("submit", "withdraw"):
        _unsupported("reporting_record", action)
    _unsupported("reporting_record", action)


async def _dispatch_incoming_inspection(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.quality_service import IncomingInspectionService

    svc = IncomingInspectionService()
    if action == "approve":
        return await svc.approve_inspection(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_inspection(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.revoke_approval(tenant_id, entity_id, user_id)
    if action in ("submit", "withdraw"):
        _unsupported("incoming_inspection", action)
    _unsupported("incoming_inspection", action)


async def _dispatch_process_inspection(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.quality_service import ProcessInspectionService

    svc = ProcessInspectionService()
    if action == "approve":
        return await svc.approve_inspection(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_inspection(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.revoke_approval(tenant_id, entity_id, user_id)
    if action in ("submit", "withdraw"):
        _unsupported("process_inspection", action)
    _unsupported("process_inspection", action)


async def _dispatch_finished_goods_inspection(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.quality_service import FinishedGoodsInspectionService

    svc = FinishedGoodsInspectionService()
    if action == "approve":
        return await svc.approve_inspection(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_inspection(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.revoke_approval(tenant_id, entity_id, user_id)
    if action in ("submit", "withdraw"):
        _unsupported("finished_goods_inspection", action)
    _unsupported("finished_goods_inspection", action)


async def _dispatch_oqc_inspection(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.quality_improvement_service import OQCInspectionService

    svc = OQCInspectionService()
    if action == "approve":
        return await svc.approve(tenant_id, entity_id, user_id, approve=True)
    if action == "reject":
        return await svc.approve(tenant_id, entity_id, user_id, approve=False)
    if action == "revoke":
        return await svc.revoke_approval(tenant_id, entity_id, user_id)
    if action in ("submit", "withdraw"):
        _unsupported("oqc_inspection", action)
    _unsupported("oqc_inspection", action)


async def _dispatch_receivable(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaicaiwu.services.finance_service import ReceivableService

    svc = ReceivableService()
    if action == "submit":
        return await svc.submit_receivable(tenant_id, entity_id, user_id)
    if action == "withdraw":
        return await svc.withdraw_receivable(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_receivable(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_receivable(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.revoke_receivable(tenant_id, entity_id, user_id)
    _unsupported("receivable", action)


async def _dispatch_payable(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaicaiwu.services.finance_service import PayableService

    svc = PayableService()
    if action == "submit":
        return await svc.submit_payable(tenant_id, entity_id, user_id)
    if action == "withdraw":
        return await svc.withdraw_payable(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_payable(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_payable(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.revoke_payable(tenant_id, entity_id, user_id)
    _unsupported("payable", action)


async def _dispatch_purchase_invoice(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService

    svc = PurchaseInvoiceService()
    if action == "submit":
        return await svc.submit_invoice(tenant_id, entity_id, user_id)
    if action == "withdraw":
        return await svc.withdraw_invoice(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_invoice(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_invoice(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "revoke":
        return await svc.revoke_invoice(tenant_id, entity_id, user_id)
    _unsupported("purchase_invoice", action)


async def _dispatch_bom_change(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.master_data.services.bom_change_service import BOMChangeService

    if action == "submit":
        return await BOMChangeService.submit_change(tenant_id, entity_id, user_id)
    if action == "approve":
        change = await BOMChangeService._get_change_or_raise(tenant_id, entity_id)
        return await BOMChangeService.approve_change(
            tenant_id, change.uuid, user_id, True, reason
        )
    if action == "reject":
        change = await BOMChangeService._get_change_or_raise(tenant_id, entity_id)
        return await BOMChangeService.approve_change(
            tenant_id, change.uuid, user_id, False, reason or "审批驳回"
        )
    if action == "withdraw":
        return await BOMChangeService.withdraw_change(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await BOMChangeService.revoke_change(tenant_id, entity_id, user_id)
    _unsupported("bom_change", action)


async def _dispatch_process_route_change(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.master_data.services.process_route_change_service import ProcessRouteChangeService

    if action == "submit":
        return await ProcessRouteChangeService.submit_change(tenant_id, entity_id, user_id)
    if action == "approve":
        change = await ProcessRouteChangeService._get_change_or_raise(tenant_id, entity_id)
        return await ProcessRouteChangeService.approve_change(
            tenant_id, change.uuid, user_id, True, reason
        )
    if action == "reject":
        change = await ProcessRouteChangeService._get_change_or_raise(tenant_id, entity_id)
        return await ProcessRouteChangeService.approve_change(
            tenant_id, change.uuid, user_id, False, reason or "审批驳回"
        )
    if action == "withdraw":
        return await ProcessRouteChangeService.withdraw_change(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await ProcessRouteChangeService.revoke_change(tenant_id, entity_id, user_id)
    _unsupported("process_route_change", action)


async def _dispatch_freight_bill(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.services.freight_bill_service import FreightBillService

    svc = FreightBillService()
    if action == "submit":
        return await svc.submit_freight_bill(tenant_id, entity_id, user_id)
    if action == "approve":
        return await svc.approve_freight_bill(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.reject_freight_bill(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_freight_bill_submit(tenant_id, entity_id, user_id)
    if action == "revoke":
        return await svc.revoke_freight_bill_approval(tenant_id, entity_id, user_id)
    _unsupported("freight_bill", action)


async def _dispatch_kuaioa_form_request(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaioa.services.form_service import FormRequestService, apply_form_request_decision

    svc = FormRequestService()
    if action == "submit":
        return await svc.submit_request(tenant_id, entity_id, user_id)
    if action == "approve":
        await apply_form_request_decision(tenant_id, entity_id, True, user_id)
        return await svc.get_request(tenant_id, entity_id)
    if action == "reject":
        await apply_form_request_decision(tenant_id, entity_id, False, user_id)
        return await svc.get_request(tenant_id, entity_id)
    if action == "revoke":
        return await svc.revoke_request(tenant_id, entity_id, user_id)
    _unsupported("kuaioa_form_request", action)


async def _dispatch_kuaioa_asset_purchase(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaioa.services.asset_service import AssetPurchaseService, apply_asset_purchase_decision

    svc = AssetPurchaseService()
    if action == "submit":
        return await svc.submit_purchase(tenant_id, entity_id, user_id)
    if action == "approve":
        await apply_asset_purchase_decision(tenant_id, entity_id, True, user_id)
        return await svc.get_purchase(tenant_id, entity_id)
    if action == "reject":
        await apply_asset_purchase_decision(tenant_id, entity_id, False, user_id)
        return await svc.get_purchase(tenant_id, entity_id)
    if action == "revoke":
        return await svc.revoke_purchase(tenant_id, entity_id, user_id)
    _unsupported("kuaioa_asset_purchase", action)


HANDLERS: Dict[str, DispatchFn] = {
    "sales_order": _dispatch_sales_order,
    "sales_order_change": _dispatch_sales_order_change,
    "sales_forecast": _dispatch_sales_forecast,
    "sales_contract": _dispatch_sales_contract,
    "quotation": _dispatch_quotation,
    "shipment_notice": _dispatch_shipment_notice,
    "sales_delivery": _dispatch_sales_delivery,
    "sales_return": _dispatch_sales_return,
    "sales_contract_change": _dispatch_sales_contract_change,
    "demand": _dispatch_demand,
    "purchase_order": _dispatch_purchase_order,
    "purchase_order_change": _dispatch_purchase_order_change,
    "purchase_request": _dispatch_purchase_request,
    "purchase_inquiry": _dispatch_purchase_inquiry,
    "reporting_record": _dispatch_reporting_record,
    "incoming_inspection": _dispatch_incoming_inspection,
    "process_inspection": _dispatch_process_inspection,
    "finished_goods_inspection": _dispatch_finished_goods_inspection,
    "oqc_inspection": _dispatch_oqc_inspection,
    "receivable": _dispatch_receivable,
    "payable": _dispatch_payable,
    "purchase_invoice": _dispatch_purchase_invoice,
    "bom_change": _dispatch_bom_change,
    "process_route_change": _dispatch_process_route_change,
    "freight_bill": _dispatch_freight_bill,
    "kuaioa_form_request": _dispatch_kuaioa_form_request,
    "kuaioa_asset_purchase": _dispatch_kuaioa_asset_purchase,
}
