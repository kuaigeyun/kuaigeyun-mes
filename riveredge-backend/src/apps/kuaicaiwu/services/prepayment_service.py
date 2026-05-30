"""
预收/预付核销服务：将预收收款单、预付付款单核销至应收/应付。
"""

from __future__ import annotations

from decimal import Decimal

from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.services.finance_service import AccountSettlementService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PrepaymentService:
    async def apply_receipt_to_receivable(
        self,
        tenant_id: int,
        *,
        receipt_id: int,
        receivable_id: int,
        amount: Decimal,
        operator_id: int,
    ):
        receipt = await Receipt.get_or_none(
            tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
        )
        if not receipt:
            raise NotFoundError("收款单不存在")
        if getattr(receipt, "settlement_type", "normal") != "prepayment":
            raise ValidationError("仅预收类型收款单可执行转核销应收")
        if receipt.unsettled_amount <= 0:
            raise ValidationError("收款单无可用预收余额")

        receivable = await Receivable.get_or_none(
            tenant_id=tenant_id, id=receivable_id, deleted_at__isnull=True
        )
        if not receivable:
            raise NotFoundError("应收单不存在")
        if receivable.customer_id != receipt.customer_id:
            raise ValidationError("预收收款单与应收单客户不一致")
        if receivable.remaining_amount <= 0:
            raise ValidationError("应收单已无待收余额")

        amt = Decimal(str(amount)).quantize(Decimal("0.01"))
        if amt <= 0:
            raise ValidationError("核销金额必须大于 0")

        settlement = await AccountSettlementService().settle_receivable(
            tenant_id, receivable_id, receipt_id, amt, operator_id
        )
        return {
            "settlement_id": settlement.id,
            "settlement_code": settlement.settlement_code,
            "amount": float(amt),
            "receipt_id": receipt_id,
            "receivable_id": receivable_id,
        }

    async def apply_payment_to_payable(
        self,
        tenant_id: int,
        *,
        payment_id: int,
        payable_id: int,
        amount: Decimal,
        operator_id: int,
    ):
        payment = await Payment.get_or_none(
            tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True
        )
        if not payment:
            raise NotFoundError("付款单不存在")
        if getattr(payment, "settlement_type", "normal") != "prepayment":
            raise ValidationError("仅预付类型付款单可执行转核销应付")
        if payment.unsettled_amount <= 0:
            raise ValidationError("付款单无可用预付余额")

        payable = await Payable.get_or_none(
            tenant_id=tenant_id, id=payable_id, deleted_at__isnull=True
        )
        if not payable:
            raise NotFoundError("应付单不存在")
        if payable.supplier_id != payment.supplier_id:
            raise ValidationError("预付付款单与应付单供应商不一致")
        if payable.remaining_amount <= 0:
            raise ValidationError("应付单已无待付余额")

        amt = Decimal(str(amount)).quantize(Decimal("0.01"))
        if amt <= 0:
            raise ValidationError("核销金额必须大于 0")

        settlement = await AccountSettlementService().settle_payable(
            tenant_id, payable_id, payment_id, amt, operator_id
        )
        return {
            "settlement_id": settlement.id,
            "settlement_code": settlement.settlement_code,
            "amount": float(amt),
            "payment_id": payment_id,
            "payable_id": payable_id,
        }
