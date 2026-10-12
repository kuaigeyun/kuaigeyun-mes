"""
从采购订单/入库/往来对账/应付创建付款申请
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.payable import Payable
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.schemas.payment_application import (
    PaymentApplicationCreate,
    PaymentApplicationLineCreate,
)
from apps.kuaizhizao.services.document_action_policy.purchase_order import (
    assert_purchase_order_capability,
    derive_purchase_order_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    _order_prepayment_linked_by_ids,
)
from apps.kuaizhizao.services.payable_open_amount_service import PayableOpenAmountService
from apps.kuaizhizao.services.payment_application_service import PaymentApplicationService
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError


class PaymentApplicationPullService:
    def __init__(self) -> None:
        self._apps = PaymentApplicationService()
        self._open = PayableOpenAmountService()

    _PREPAY_APP_RESERVE_STATUSES = frozenset(
        {"已批准", "部分付款", "待审核", "已付款", "APPROVED", "AUDITED", "PENDING", "已通过"}
    )

    async def prepayment_reserved_by_order_ids(
        self, tenant_id: int, purchase_order_ids: List[int]
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {oid: Decimal("0") for oid in purchase_order_ids}
        if not purchase_order_ids:
            return result
        from apps.kuaizhizao.models.payment_application import PaymentApplication, PaymentApplicationLine

        lines = await PaymentApplicationLine.filter(
            tenant_id=tenant_id,
            source_type="purchase_order",
            source_id__in=purchase_order_ids,
            line_kind="prepayment",
        ).all()
        if not lines:
            return result
        app_ids = {int(l.application_id) for l in lines}
        apps = await PaymentApplication.filter(
            tenant_id=tenant_id,
            id__in=list(app_ids),
            deleted_at__isnull=True,
            status__in=list(self._PREPAY_APP_RESERVE_STATUSES),
        ).all()
        active_app_ids = {int(a.id) for a in apps if str(a.status) != "已驳回"}
        for line in lines:
            oid = int(line.source_id or 0)
            if oid not in result or int(line.application_id) not in active_app_ids:
                continue
            req = Decimal(str(line.request_amount or 0))
            paid = Decimal(str(line.paid_amount or 0))
            result[oid] += max(Decimal("0"), req - paid)
        return result

    async def _sum_prepayment_application_reserved(
        self, tenant_id: int, purchase_order_id: int
    ) -> Decimal:
        reserved_map = await self.prepayment_reserved_by_order_ids(
            tenant_id, [purchase_order_id]
        )
        return reserved_map.get(purchase_order_id, Decimal("0"))

    async def preview_from_purchase_order(
        self, tenant_id: int, purchase_order_id: int
    ) -> Dict[str, Any]:
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=purchase_order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {purchase_order_id}")
        prepay_map = await _order_prepayment_linked_by_ids(
            tenant_id, [purchase_order_id], source_type="purchase_order", target_type="payment"
        )
        caps = derive_purchase_order_capabilities(
            order, has_prepayment_payment=prepay_map.get(purchase_order_id, False)
        )
        prepay_cap = caps.push_prepayment
        amount = Decimal(str(order.prepayment_amount or 0))
        reserved = await self._sum_prepayment_application_reserved(tenant_id, purchase_order_id)
        max_push = max(Decimal("0"), amount - reserved)
        allowed = prepay_cap.allowed and max_push > 0
        return {
            "target_type": "payment_application",
            "source_type": "purchase_order",
            "source_id": purchase_order_id,
            "source_code": order.order_code,
            "order_code": order.order_code,
            "max_push_quantity": float(max_push),
            "summary": (
                f"将按采购订单 {order.order_code} 生成预付类付款申请（可请款 {max_push}）"
                if allowed
                else "当前采购订单不可下推付款申请"
            ),
            "items": [],
            "has_blocking_issues": not allowed,
            "blocking_reason": prepay_cap.reason if not prepay_cap.allowed else (
                "payment_application.pull_from_purchase_order.no_amount" if max_push <= 0 else None
            ),
            "supplier_id": order.supplier_id,
            "supplier_name": order.supplier_name,
        }

    async def create_from_purchase_order(
        self,
        tenant_id: int,
        purchase_order_id: int,
        amount: Decimal,
        created_by: int,
    ):
        preview = await self.preview_from_purchase_order(tenant_id, purchase_order_id)
        if preview.get("has_blocking_issues"):
            raise BusinessLogicError(preview.get("blocking_reason") or "不可下推付款申请")
        max_push = Decimal(str(preview.get("max_push_quantity") or 0))
        if amount > max_push:
            raise ValidationError(f"申请金额超过可预付请款额度 {max_push}")
        order = await PurchaseOrder.get(id=purchase_order_id)
        if not order.supplier_id:
            raise BusinessLogicError("采购订单未指定供应商")
        create = PaymentApplicationCreate(
            supplier_id=int(order.supplier_id),
            supplier_name=str(order.supplier_name or ""),
            application_kind="prepayment",
            items=[
                PaymentApplicationLineCreate(
                    source_type="purchase_order",
                    source_id=purchase_order_id,
                    source_code=order.order_code,
                    line_kind="prepayment",
                    request_amount=amount,
                )
            ],
        )
        return await self._apps.create_application(tenant_id, create, created_by)

    async def _payable_for_receipt(self, tenant_id: int, receipt_id: int) -> Payable:
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="purchase_receipt",
            source_id=receipt_id,
            target_type="payable",
        ).first()
        if not rel or not rel.target_id:
            raise BusinessLogicError("该入库单尚未生成应付单，请先确认入库或创建应付")
        payable = await Payable.get_or_none(
            tenant_id=tenant_id, id=int(rel.target_id), deleted_at__isnull=True
        )
        if not payable:
            raise NotFoundError("应付单不存在")
        return payable

    async def create_from_purchase_receipt(
        self,
        tenant_id: int,
        purchase_receipt_id: int,
        amount: Optional[Decimal],
        created_by: int,
    ):
        payable = await self._payable_for_receipt(tenant_id, purchase_receipt_id)
        max_req = await self._open.max_request_for_payable(tenant_id, payable)
        if max_req <= 0:
            raise BusinessLogicError("该应付单无可请款余额")
        req_amount = amount if amount is not None else max_req
        if req_amount > max_req:
            raise ValidationError(f"申请金额超过可请款 {max_req}")
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
        code = receipt.receipt_code if receipt else str(purchase_receipt_id)
        create = PaymentApplicationCreate(
            supplier_id=int(payable.supplier_id),
            supplier_name=str(payable.supplier_name or ""),
            application_kind="goods",
            items=[
                PaymentApplicationLineCreate(
                    source_type="purchase_receipt",
                    source_id=purchase_receipt_id,
                    source_code=code,
                    payable_id=int(payable.id),
                    payable_code=payable.payable_code,
                    line_kind="goods",
                    request_amount=req_amount,
                )
            ],
        )
        return await self._apps.create_application(tenant_id, create, created_by)

    async def create_from_reconciliation(
        self,
        tenant_id: int,
        supplier_id: int,
        items: List[Dict[str, Any]],
        created_by: int,
    ):
        lines: List[PaymentApplicationLineCreate] = []
        for row in items:
            doc_type = str(row.get("doc_type") or "").strip().lower().replace("-", "_")
            doc_id = int(row.get("doc_id") or 0)
            amount = Decimal(str(row.get("amount") or 0))
            if amount <= 0 or not doc_id:
                raise ValidationError("对账行金额或单据无效")
            if doc_type == "payable":
                payable = await Payable.get_or_none(
                    tenant_id=tenant_id, id=doc_id, deleted_at__isnull=True
                )
                if not payable or int(payable.supplier_id) != supplier_id:
                    raise ValidationError(f"应付单 {doc_id} 不可用")
                max_req = await self._open.max_request_for_payable(tenant_id, payable)
                if amount > max_req:
                    raise ValidationError(f"应付 {payable.payable_code} 超过可请款 {max_req}")
                lines.append(
                    PaymentApplicationLineCreate(
                        source_type="document_reconciliation",
                        source_id=doc_id,
                        source_code=payable.payable_code,
                        payable_id=int(payable.id),
                        payable_code=payable.payable_code,
                        line_kind="goods",
                        request_amount=amount,
                    )
                )
            else:
                raise ValidationError(f"暂不支持从 {doc_type} 对账下推，请选用应付单")
        if not lines:
            raise ValidationError("无有效对账行")
        supplier_name = lines[0].payable_code or ""
        payable0 = await Payable.get(id=int(lines[0].payable_id))
        create = PaymentApplicationCreate(
            supplier_id=supplier_id,
            supplier_name=str(payable0.supplier_name or supplier_name),
            application_kind="mixed" if len(lines) > 1 else "goods",
            items=lines,
        )
        return await self._apps.create_application(tenant_id, create, created_by)

    async def list_payable_pull_lines(
        self,
        tenant_id: int,
        supplier_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        approved_reviews = ("已审核", "APPROVED", "审核通过")
        query = (
            Payable.filter(
                tenant_id=tenant_id,
                supplier_id=supplier_id,
                deleted_at__isnull=True,
                remaining_amount__gt=0,
                review_status__in=approved_reviews,
            )
            .exclude(status="已结清")
        )
        kw = str(keyword or "").strip()
        if kw:
            from tortoise.expressions import Q

            query = query.filter(Q(payable_code__icontains=kw))
        payables = await query.offset(skip).limit(limit).order_by("-created_at")
        rows = []
        for p in payables:
            max_req = await self._open.max_request_for_payable(tenant_id, p)
            if max_req <= 0:
                continue
            rows.append(
                {
                    "payable_id": p.id,
                    "payable_code": p.payable_code,
                    "remaining_amount": float(p.remaining_amount or 0),
                    "max_request_amount": float(max_req),
                    "supplier_name": p.supplier_name,
                }
            )
        return {"data": rows, "total": len(rows)}

    async def list_for_payment_pull(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        supplier_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.payment_application import PaymentApplication

        query = PaymentApplication.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=["已批准", "部分付款"],
            remaining_amount__gt=0,
        )
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        kw = str(keyword or "").strip()
        if kw:
            from tortoise.expressions import Q

            query = query.filter(
                Q(application_code__icontains=kw) | Q(supplier_name__icontains=kw)
            )
        total = await query.count()
        apps = await query.offset(skip).limit(limit).order_by("-created_at")
        rows = []
        for app in apps:
            rows.append(
                {
                    "id": app.id,
                    "code": f"{app.application_code} - {app.supplier_name}",
                    "application_code": app.application_code,
                    "supplier_name": app.supplier_name,
                    "remaining_amount": float(app.remaining_amount or 0),
                    "capabilities": {
                        "pull_payment": {"allowed": True, "reason": None},
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def preview_pull_for_payment(
        self, tenant_id: int, application_id: int
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.payment_application import PaymentApplication

        app = await PaymentApplication.get_or_none(
            tenant_id=tenant_id, id=application_id, deleted_at__isnull=True
        )
        if not app:
            raise NotFoundError(f"付款申请单不存在: {application_id}")
        remaining = Decimal(str(app.remaining_amount or 0))
        allowed = str(app.status) in ("已批准", "部分付款") and remaining > 0
        return {
            "target_type": "payment",
            "source_type": "payment_application",
            "source_id": application_id,
            "source_code": app.application_code,
            "supplier_id": app.supplier_id,
            "supplier_name": app.supplier_name,
            "items": [
                {
                    "item_id": application_id,
                    "source_code": app.application_code,
                    "max_push_quantity": float(remaining),
                }
            ],
            "has_blocking_issues": not allowed,
            "blocking_reason": None if allowed else "payment.pull_from_payment_application.not_allowed",
        }
