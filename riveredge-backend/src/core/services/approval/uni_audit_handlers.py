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


async def _dispatch_production_plan(
    action: str,
    *,
    tenant_id: int,
    entity_id: int,
    user_id: int,
    reason: Optional[str],
) -> Any:
    from apps.kuaizhizao.models.production_plan import ProductionPlan
    from apps.kuaizhizao.services.planning_service import ProductionPlanningService
    from infra.exceptions.exceptions import BusinessLogicError, NotFoundError

    svc = ProductionPlanningService()
    if action == "submit":
        plan = await ProductionPlan.get_or_none(
            tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
        )
        if not plan:
            raise NotFoundError(f"生产计划不存在: {entity_id}")
        if plan.status == "已驳回":
            return await svc.submit_production_plan(tenant_id, entity_id, user_id)
        if plan.status == "草稿":
            await ProductionPlan.filter(tenant_id=tenant_id, id=entity_id).update(
                status="待审核",
                review_status="待审核",
                updated_by=user_id,
            )
            return await svc.get_production_plan_by_id(tenant_id, entity_id)
        raise BusinessLogicError(f"当前状态不可提交审核: {plan.status}")
    if action == "approve":
        return await svc.approve_production_plan(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_production_plan(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action == "withdraw":
        return await svc.withdraw_production_plan(tenant_id, entity_id, user_id)
    if action == "revoke":
        _unsupported("production_plan", action)
    _unsupported("production_plan", action)


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
        _unsupported("purchase_order", action)
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
    if action in ("submit", "withdraw", "revoke"):
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
    if action in ("submit", "withdraw", "revoke"):
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
    if action in ("submit", "withdraw", "revoke"):
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
    if action == "approve":
        return await svc.approve_receivable(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_receivable(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action in ("submit", "withdraw", "revoke"):
        _unsupported("receivable", action)
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
    if action == "approve":
        return await svc.approve_payable(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_payable(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action in ("submit", "withdraw", "revoke"):
        _unsupported("payable", action)
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
    if action == "approve":
        return await svc.approve_invoice(tenant_id, entity_id, user_id)
    if action == "reject":
        return await svc.approve_invoice(
            tenant_id, entity_id, user_id, rejection_reason=reason or "审批驳回"
        )
    if action in ("submit", "withdraw", "revoke"):
        _unsupported("purchase_invoice", action)
    _unsupported("purchase_invoice", action)


HANDLERS: Dict[str, DispatchFn] = {
    "sales_order": _dispatch_sales_order,
    "sales_order_change": _dispatch_sales_order_change,
    "sales_forecast": _dispatch_sales_forecast,
    "sales_contract": _dispatch_sales_contract,
    "quotation": _dispatch_quotation,
    "demand": _dispatch_demand,
    "production_plan": _dispatch_production_plan,
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
}
