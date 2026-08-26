"""
收付款单过账服务。

主流 ERP 统一规则：草稿不产生资金流水与往来核销；确认（过账）后一次性执行。
"""

from __future__ import annotations

from typing import Optional

from apps.common.audit_actor import apply_update_audit
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.services.bank_account_service import BankAccountService
from apps.kuaicaiwu.services.payment_pull_service import PaymentPullService
from apps.kuaicaiwu.services.receipt_pull_service import ReceiptPullService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class FinanceVoucherPostingService:
    """收款单 / 付款单确认过账（核销 + 资金流水）。"""

    async def post_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        *,
        operator: Optional[User] = None,
        operator_id: Optional[int] = None,
    ) -> Receipt:
        receipt = await Receipt.get_or_none(
            tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
        )
        if not receipt:
            raise NotFoundError(f"收款单不存在: {receipt_id}")
        if receipt.status not in ("Draft", "Confirmed"):
            raise ValidationError("只有草稿或待补流水的收款单可以过账")

        op_id = operator_id or (operator.id if operator else None)
        if op_id is None:
            raise ValidationError("缺少操作人")

        bank_svc = BankAccountService()
        await bank_svc.validate_voucher_account(
            tenant_id,
            payment_method=receipt.payment_method,
            bank_account_id=receipt.bank_account_id,
        )

        if receipt.status == "Draft":
            pull_svc = ReceiptPullService()
            await pull_svc.settle_draft_receipt_if_linked(
                tenant_id=tenant_id,
                receipt_id=receipt_id,
                operator_id=op_id,
            )
            receipt = await Receipt.get_or_none(
                tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
            )
            if not receipt:
                raise NotFoundError(f"收款单不存在: {receipt_id}")
            if receipt.status == "Draft":
                confirm_payload: dict = {"status": "Confirmed"}
                apply_update_audit(confirm_payload, operator)
                await Receipt.filter(id=receipt_id).update(**confirm_payload)
                receipt = await Receipt.get_or_none(
                    tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
                )
                if not receipt:
                    raise NotFoundError(f"收款单不存在: {receipt_id}")

        if receipt.bank_account_id:
            await bank_svc.sync_from_confirmed_voucher(
                tenant_id,
                voucher_type="receipt",
                voucher_id=receipt_id,
                operator_id=op_id,
            )

        return receipt

    async def post_payment(
        self,
        tenant_id: int,
        payment_id: int,
        *,
        operator: Optional[User] = None,
        operator_id: Optional[int] = None,
    ) -> Payment:
        payment = await Payment.get_or_none(
            tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True
        )
        if not payment:
            raise NotFoundError(f"付款单不存在: {payment_id}")
        if payment.status not in ("Draft", "Confirmed"):
            raise ValidationError("只有草稿或待补流水的付款单可以过账")

        op_id = operator_id or (operator.id if operator else None)
        if op_id is None:
            raise ValidationError("缺少操作人")

        bank_svc = BankAccountService()
        await bank_svc.validate_voucher_account(
            tenant_id,
            payment_method=payment.payment_method,
            bank_account_id=payment.bank_account_id,
        )

        if payment.status == "Draft":
            pull_svc = PaymentPullService()
            await pull_svc.settle_draft_payment_if_linked(
                tenant_id=tenant_id,
                payment_id=payment_id,
                operator_id=op_id,
            )
            payment = await Payment.get_or_none(
                tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True
            )
            if not payment:
                raise NotFoundError(f"付款单不存在: {payment_id}")
            if payment.status == "Draft":
                confirm_payload: dict = {"status": "Confirmed"}
                apply_update_audit(confirm_payload, operator)
                await Payment.filter(id=payment_id).update(**confirm_payload)
                payment = await Payment.get_or_none(
                    tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True
                )
                if not payment:
                    raise NotFoundError(f"付款单不存在: {payment_id}")

        if payment.bank_account_id:
            await bank_svc.sync_from_confirmed_voucher(
                tenant_id,
                voucher_type="payment",
                voucher_id=payment_id,
                operator_id=op_id,
            )

        return payment
