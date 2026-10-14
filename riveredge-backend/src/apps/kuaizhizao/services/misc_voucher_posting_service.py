"""其他收支确认过账：经应收/应付拉单生成收付款并确认（银行流水由收付款过账写入）。"""

from __future__ import annotations

from decimal import Decimal

from apps.common.audit_actor import apply_update_audit
from apps.kuaizhizao.models.other_voucher import OtherExpense, OtherIncome
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.services.bank_account_service import BankAccountService
from apps.kuaizhizao.services.document_action_policy.other_expense import (
    assert_other_expense_capability,
)
from apps.kuaizhizao.services.document_action_policy.other_income import (
    assert_other_income_capability,
)
from apps.kuaicaiwu.services.invoice_concurrent_settlement import (
    create_concurrent_payment_for_payable,
    create_concurrent_receipt_for_receivable,
)
from apps.kuaizhizao.services.misc_voucher_finance_bridge import MiscVoucherFinanceBridge
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class MiscVoucherPostingService:
    async def post_other_income(
        self,
        tenant_id: int,
        income_id: int,
        *,
        operator: User | None = None,
        operator_id: int | None = None,
    ) -> OtherIncome:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        assert_other_income_capability(head, "confirm")
        if head.status not in ("Approved", "Confirmed"):
            raise ValidationError("仅已审核的其他费用收入单可确认过账")

        if head.status == "Confirmed":
            return head

        if not operator:
            op_id = operator_id
            if op_id is None:
                raise ValidationError("缺少操作人")
            operator = await User.filter(id=op_id).first()
            if not operator:
                raise ValidationError("操作人不存在")

        bank_svc = BankAccountService()
        await bank_svc.validate_voucher_account(
            tenant_id,
            payment_method=head.payment_method,
            bank_account_id=head.bank_account_id,
        )
        if not head.bank_account_id:
            raise ValidationError("确认过账须选择银行账户")

        bridge = MiscVoucherFinanceBridge()
        receivable = await bridge.get_receivable_for_income(tenant_id, income_id)
        if not receivable:
            raise ValidationError("未找到关联应收单，请确认已审核且已选择客户往来")

        links = await bridge.finance_links_for_income(tenant_id, income_id)
        if links.get("receipt_id"):
            raise ValidationError("该单据已确认过账")

        receipt_id = await create_concurrent_receipt_for_receivable(
            tenant_id=tenant_id,
            receivable_id=int(receivable.id),
            total_amount=Decimal(str(head.total_amount or 0)),
            payment_method=str(head.payment_method),
            bank_account_id=head.bank_account_id,
            bank_account=head.bank_account,
            receipt_date=head.business_date,
            notes=f"其他费用收入 {head.income_code} 确认收款",
            current_user=operator,
        )
        receipt = await Receipt.get(id=receipt_id)
        await bridge.link_income_receipt(
            tenant_id,
            income_id,
            str(head.income_code),
            receipt_id,
            str(receipt.receipt_code),
            operator.id,
        )

        payload: dict = {"status": "Confirmed"}
        apply_update_audit(payload, operator)
        await OtherIncome.filter(id=income_id).update(**payload)
        refreshed = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not refreshed:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        return refreshed

    async def unpost_other_income(
        self,
        tenant_id: int,
        income_id: int,
        *,
        operator_id: int,
    ) -> OtherIncome:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        assert_other_income_capability(head, "unconfirm")
        if head.status != "Confirmed":
            raise ValidationError("仅已确认的单据可反确认")

        links = await MiscVoucherFinanceBridge().finance_links_for_income(tenant_id, income_id)
        receipt_id = links.get("receipt_id")
        if not receipt_id:
            raise ValidationError("未找到关联收款单，无法反确认")

        from apps.kuaicaiwu.services.finance_voucher_correction import (
            assert_voucher_correction_allowed,
            apply_confirmed_voucher_unpost,
        )

        receipt = await Receipt.get_or_none(tenant_id=tenant_id, id=int(receipt_id))
        if not receipt:
            raise NotFoundError(f"收款单不存在: {receipt_id}")
        assert_voucher_correction_allowed(receipt, action="unconfirm")
        await apply_confirmed_voucher_unpost(
            tenant_id,
            voucher_type="receipt",
            voucher_id=int(receipt_id),
            operator_id=operator_id,
        )
        user = await User.filter(id=operator_id).first()
        draft_payload: dict = {"status": "Draft"}
        apply_update_audit(draft_payload, user)
        await Receipt.filter(id=int(receipt_id)).update(**draft_payload)

        payload: dict = {"status": "Approved"}
        apply_update_audit(payload, user)
        await OtherIncome.filter(id=income_id).update(**payload)
        refreshed = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not refreshed:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        return refreshed

    async def post_other_expense(
        self,
        tenant_id: int,
        expense_id: int,
        *,
        operator: User | None = None,
        operator_id: int | None = None,
    ) -> OtherExpense:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        assert_other_expense_capability(head, "confirm")
        if head.status not in ("Approved", "Confirmed"):
            raise ValidationError("仅已审核的其他费用支出单可确认过账")

        if head.status == "Confirmed":
            return head

        if not operator:
            op_id = operator_id
            if op_id is None:
                raise ValidationError("缺少操作人")
            operator = await User.filter(id=op_id).first()
            if not operator:
                raise ValidationError("操作人不存在")

        bank_svc = BankAccountService()
        await bank_svc.validate_voucher_account(
            tenant_id,
            payment_method=head.payment_method,
            bank_account_id=head.bank_account_id,
        )
        if not head.bank_account_id:
            raise ValidationError("确认过账须选择银行账户")
        await self._assert_out_funds(bank_svc, tenant_id, head)

        bridge = MiscVoucherFinanceBridge()
        payable = await bridge.get_payable_for_expense(tenant_id, expense_id)
        if not payable:
            raise ValidationError("未找到关联应付单，请确认已审核且已选择供应商往来")

        links = await bridge.finance_links_for_expense(tenant_id, expense_id)
        if links.get("payment_id"):
            raise ValidationError("该单据已确认过账")

        payment_id = await create_concurrent_payment_for_payable(
            tenant_id=tenant_id,
            payable_id=int(payable.id),
            total_amount=Decimal(str(head.total_amount or 0)),
            payment_method=str(head.payment_method),
            bank_account_id=head.bank_account_id,
            bank_account=head.bank_account,
            payment_date=head.business_date,
            notes=f"其他费用支出 {head.expense_code} 确认付款",
            current_user=operator,
        )
        payment = await Payment.get(id=payment_id)
        await bridge.link_expense_payment(
            tenant_id,
            expense_id,
            str(head.expense_code),
            payment_id,
            str(payment.payment_code),
            operator.id,
        )

        payload: dict = {"status": "Confirmed"}
        apply_update_audit(payload, operator)
        await OtherExpense.filter(id=expense_id).update(**payload)
        refreshed = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not refreshed:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        return refreshed

    async def unpost_other_expense(
        self,
        tenant_id: int,
        expense_id: int,
        *,
        operator_id: int,
    ) -> OtherExpense:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        assert_other_expense_capability(head, "unconfirm")
        if head.status != "Confirmed":
            raise ValidationError("仅已确认的单据可反确认")

        links = await MiscVoucherFinanceBridge().finance_links_for_expense(tenant_id, expense_id)
        payment_id = links.get("payment_id")
        if not payment_id:
            raise ValidationError("未找到关联付款单，无法反确认")

        from apps.kuaicaiwu.services.finance_voucher_correction import (
            assert_voucher_correction_allowed,
            apply_confirmed_voucher_unpost,
        )

        payment = await Payment.get_or_none(tenant_id=tenant_id, id=int(payment_id))
        if not payment:
            raise NotFoundError(f"付款单不存在: {payment_id}")
        assert_voucher_correction_allowed(payment, action="unconfirm")
        await apply_confirmed_voucher_unpost(
            tenant_id,
            voucher_type="payment",
            voucher_id=int(payment_id),
            operator_id=operator_id,
        )
        user = await User.filter(id=operator_id).first()
        draft_payload: dict = {"status": "Draft"}
        apply_update_audit(draft_payload, user)
        await Payment.filter(id=int(payment_id)).update(**draft_payload)

        payload: dict = {"status": "Approved"}
        apply_update_audit(payload, user)
        await OtherExpense.filter(id=expense_id).update(**payload)
        refreshed = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not refreshed:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        return refreshed

    @staticmethod
    async def _assert_out_funds(
        bank_svc: BankAccountService, tenant_id: int, head: OtherExpense
    ) -> None:
        bank_account_id = head.bank_account_id
        if not bank_account_id:
            return
        amt = Decimal(str(head.total_amount or 0))
        if amt <= 0:
            return
        account = await bank_svc.get_by_id(tenant_id, int(bank_account_id))
        current = Decimal(str(account.current_balance or 0))
        if current - amt < 0:
            raise ValidationError(
                f"账户 {account.account_code} 余额不足，当前 {current}，本次出款 {amt}"
            )
