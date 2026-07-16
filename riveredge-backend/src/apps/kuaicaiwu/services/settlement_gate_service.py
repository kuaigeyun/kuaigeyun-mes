"""
往来核销门控：应收↔收款、应付↔付款预览与金额校验。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.settlement import SettlementRecord
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


class SettlementGateService(AppBaseService[SettlementRecord]):
    """往来核销预览与门控"""

    _RECEIVABLE_ELIGIBLE_REVIEW = frozenset({"已审核"})
    _PAYABLE_ELIGIBLE_REVIEW = frozenset({"已审核"})
    _EXCLUDED_VOUCHER_STATUSES = frozenset({"Cancelled"})

    def _money(self, value: Decimal) -> Decimal:
        return Decimal(value).quantize(Decimal("0.01"))

    def _build_doc_preview_item(
        self,
        *,
        item_id: int,
        source_code: str,
        doc_type: str,
        partner_name: str,
        total: Decimal,
        settled: Decimal,
        remaining: Decimal,
    ) -> Dict[str, Any]:
        return {
            "item_id": int(item_id),
            "source_code": source_code,
            "doc_type": doc_type,
            "partner_name": partner_name,
            "quantity": float(total),
            "pushed_quantity": float(settled),
            "max_push_quantity": float(max(Decimal("0"), remaining)),
        }

    def _receivable_settle_allowed(self, receivable: Receivable) -> bool:
        status = str(getattr(receivable, "status", "") or "").strip()
        review = str(getattr(receivable, "review_status", "") or "").strip()
        remaining = Decimal(str(receivable.remaining_amount or 0))
        if status == "已结清" or remaining <= 0:
            return False
        return review in self._RECEIVABLE_ELIGIBLE_REVIEW

    def _payable_settle_allowed(self, payable: Payable) -> bool:
        status = str(getattr(payable, "status", "") or "").strip()
        review = str(getattr(payable, "review_status", "") or "").strip()
        remaining = Decimal(str(payable.remaining_amount or 0))
        if status == "已结清" or remaining <= 0:
            return False
        return review in self._PAYABLE_ELIGIBLE_REVIEW

    def _receipt_settle_allowed(self, receipt: Receipt) -> bool:
        status = str(getattr(receipt, "status", "") or "").strip()
        if status in self._EXCLUDED_VOUCHER_STATUSES:
            return False
        return Decimal(str(receipt.unsettled_amount or 0)) > 0

    def _payment_settle_allowed(self, payment: Payment) -> bool:
        status = str(getattr(payment, "status", "") or "").strip()
        if status in self._EXCLUDED_VOUCHER_STATUSES:
            return False
        return Decimal(str(payment.unsettled_amount or 0)) > 0

    async def preview_settle_receivable(
        self,
        tenant_id: int,
        receivable_id: int,
        receipt_id: int,
    ) -> Dict[str, Any]:
        receivable = await Receivable.get_or_none(
            tenant_id=tenant_id, id=receivable_id, deleted_at__isnull=True
        )
        if not receivable:
            raise NotFoundError(f"应收单不存在: {receivable_id}")
        receipt = await Receipt.get_or_none(
            tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
        )
        if not receipt:
            raise NotFoundError(f"收款单不存在: {receipt_id}")

        rec_remaining = self._money(Decimal(str(receivable.remaining_amount or 0)))
        rcpt_unsettled = self._money(Decimal(str(receipt.unsettled_amount or 0)))
        max_settle = self._money(min(rec_remaining, rcpt_unsettled))

        blocking_reason: Optional[str] = None
        if receivable.customer_id != receipt.customer_id:
            blocking_reason = "settlement.receivable.customer_mismatch"
        elif not self._receivable_settle_allowed(receivable):
            blocking_reason = "settlement.receivable.not_allowed"
        elif not self._receipt_settle_allowed(receipt):
            blocking_reason = "settlement.receivable.receipt_not_allowed"
        elif max_settle <= 0:
            blocking_reason = "settlement.receivable.no_balance"

        allowed = blocking_reason is None
        rec_code = str(receivable.receivable_code or receivable_id)
        rcpt_code = str(receipt.receipt_code or receipt_id)
        items = [
            self._build_doc_preview_item(
                item_id=int(receivable.id),
                source_code=rec_code,
                doc_type="receivable",
                partner_name=str(receivable.customer_name or ""),
                total=self._money(Decimal(str(receivable.total_amount or 0))),
                settled=self._money(Decimal(str(receivable.received_amount or 0))),
                remaining=rec_remaining,
            ),
            self._build_doc_preview_item(
                item_id=int(receipt.id),
                source_code=rcpt_code,
                doc_type="receipt",
                partner_name=str(receipt.customer_name or ""),
                total=self._money(Decimal(str(receipt.total_amount or 0))),
                settled=self._money(Decimal(str(receipt.settled_amount or 0))),
                remaining=rcpt_unsettled,
            ),
        ]

        return {
            "target_type": "settlement",
            "business_type": "receivable",
            "receivable_id": receivable_id,
            "receipt_id": receipt_id,
            "receivable_code": rec_code,
            "receipt_code": rcpt_code,
            "customer_id": receivable.customer_id,
            "customer_name": receivable.customer_name,
            "summary": (
                f"将收款单 {rcpt_code} 核销至应收单 {rec_code}（可核销 ¥{float(max_settle):,.2f}）"
                if allowed
                else f"应收单 {rec_code} 与收款单 {rcpt_code} 当前不可核销"
            ),
            "items": items,
            "max_settle_quantity": float(max_settle),
            "has_blocking_issues": not allowed,
            "blocking_reason": blocking_reason,
            "tip": "核销金额不可超过可核销金额（取应收待收与收款余额的较小值）。",
        }

    async def preview_settle_payable(
        self,
        tenant_id: int,
        payable_id: int,
        payment_id: int,
    ) -> Dict[str, Any]:
        payable = await Payable.get_or_none(
            tenant_id=tenant_id, id=payable_id, deleted_at__isnull=True
        )
        if not payable:
            raise NotFoundError(f"应付单不存在: {payable_id}")
        payment = await Payment.get_or_none(
            tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True
        )
        if not payment:
            raise NotFoundError(f"付款单不存在: {payment_id}")

        pay_remaining = self._money(Decimal(str(payable.remaining_amount or 0)))
        pmt_unsettled = self._money(Decimal(str(payment.unsettled_amount or 0)))
        max_settle = self._money(min(pay_remaining, pmt_unsettled))

        blocking_reason: Optional[str] = None
        if payable.supplier_id != payment.supplier_id:
            blocking_reason = "settlement.payable.supplier_mismatch"
        elif not self._payable_settle_allowed(payable):
            blocking_reason = "settlement.payable.not_allowed"
        elif not self._payment_settle_allowed(payment):
            blocking_reason = "settlement.payable.payment_not_allowed"
        elif max_settle <= 0:
            blocking_reason = "settlement.payable.no_balance"

        allowed = blocking_reason is None
        pay_code = str(payable.payable_code or payable_id)
        pmt_code = str(payment.payment_code or payment_id)
        items = [
            self._build_doc_preview_item(
                item_id=int(payable.id),
                source_code=pay_code,
                doc_type="payable",
                partner_name=str(payable.supplier_name or ""),
                total=self._money(Decimal(str(payable.total_amount or 0))),
                settled=self._money(Decimal(str(payable.paid_amount or 0))),
                remaining=pay_remaining,
            ),
            self._build_doc_preview_item(
                item_id=int(payment.id),
                source_code=pmt_code,
                doc_type="payment",
                partner_name=str(payment.supplier_name or ""),
                total=self._money(Decimal(str(payment.total_amount or 0))),
                settled=self._money(Decimal(str(payment.settled_amount or 0))),
                remaining=pmt_unsettled,
            ),
        ]

        return {
            "target_type": "settlement",
            "business_type": "payable",
            "payable_id": payable_id,
            "payment_id": payment_id,
            "payable_code": pay_code,
            "payment_code": pmt_code,
            "supplier_id": payable.supplier_id,
            "supplier_name": payable.supplier_name,
            "summary": (
                f"将付款单 {pmt_code} 核销至应付单 {pay_code}（可核销 ¥{float(max_settle):,.2f}）"
                if allowed
                else f"应付单 {pay_code} 与付款单 {pmt_code} 当前不可核销"
            ),
            "items": items,
            "max_settle_quantity": float(max_settle),
            "has_blocking_issues": not allowed,
            "blocking_reason": blocking_reason,
            "tip": "核销金额不可超过可核销金额（取应付待付与付款余额的较小值）。",
        }

    async def assert_settle_receivable_allowed(
        self,
        tenant_id: int,
        *,
        receivable_id: int,
        receipt_id: int,
        amount: Decimal,
    ) -> Dict[str, Any]:
        preview = await self.preview_settle_receivable(tenant_id, receivable_id, receipt_id)
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可核销"
            raise BusinessLogicError(reason)
        max_settle = self._money(Decimal(str(preview.get("max_settle_quantity") or 0)))
        settle_amount = self._money(Decimal(str(amount)))
        if settle_amount <= 0:
            raise BusinessLogicError("settlement.amount_invalid")
        if settle_amount > max_settle:
            raise BusinessLogicError(
                f"核销金额 {settle_amount} 超过可核销金额 {max_settle}"
            )
        return preview

    async def assert_settle_payable_allowed(
        self,
        tenant_id: int,
        *,
        payable_id: int,
        payment_id: int,
        amount: Decimal,
    ) -> Dict[str, Any]:
        preview = await self.preview_settle_payable(tenant_id, payable_id, payment_id)
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可核销"
            raise BusinessLogicError(reason)
        max_settle = self._money(Decimal(str(preview.get("max_settle_quantity") or 0)))
        settle_amount = self._money(Decimal(str(amount)))
        if settle_amount <= 0:
            raise BusinessLogicError("settlement.amount_invalid")
        if settle_amount > max_settle:
            raise BusinessLogicError(
                f"核销金额 {settle_amount} 超过可核销金额 {max_settle}"
            )
        return preview
