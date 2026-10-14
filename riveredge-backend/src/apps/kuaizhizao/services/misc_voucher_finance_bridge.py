"""其他费用收支 → 应收/应付 写路径（审核挂账、确认收付款）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from apps.kuaizhizao.constants.other_voucher_sources import (
    PAYABLE_SOURCE_OTHER_EXPENSE,
    RECEIVABLE_SOURCE_OTHER_INCOME,
)
from apps.kuaizhizao.models.other_voucher import OtherExpense, OtherIncome
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.schemas.finance import PayableCreate, ReceivableCreate
from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date
from apps.kuaicaiwu.services.finance_service import PayableService, ReceivableService
from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
from infra.exceptions.exceptions import BusinessLogicError, ValidationError

class MiscVoucherFinanceBridge:
    async def ensure_receivable_on_income_approved(
        self,
        tenant_id: int,
        head: OtherIncome,
        operator_id: int,
    ) -> Tuple[int, str]:
        kind = str(head.counterparty_kind or "").strip().lower()
        if kind != "customer":
            raise ValidationError("其他费用收入审核通过须选择客户往来，才能生成应收单")
        if not head.counterparty_id:
            raise ValidationError("其他费用收入须指定客户")
        total = Decimal(str(head.total_amount or 0))
        if total <= 0:
            raise ValidationError("其他费用收入合计须大于 0")

        existing = await Receivable.get_or_none(
            tenant_id=tenant_id,
            source_type=RECEIVABLE_SOURCE_OTHER_INCOME,
            source_id=int(head.id),
            deleted_at__isnull=True,
        )
        if existing:
            return int(existing.id), str(existing.receivable_code)

        due_date = await resolve_partner_due_date(
            tenant_id, "customer", int(head.counterparty_id), head.business_date
        )
        receivable_svc = ReceivableService()
        receivable = await receivable_svc.create_receivable(
            tenant_id=tenant_id,
            receivable_data=ReceivableCreate(
                source_type=RECEIVABLE_SOURCE_OTHER_INCOME,
                source_id=int(head.id),
                source_code=str(head.income_code),
                customer_id=int(head.counterparty_id),
                customer_name=str(head.counterparty_name or ""),
                total_amount=total,
                received_amount=Decimal("0"),
                remaining_amount=total,
                due_date=due_date,
                business_date=head.business_date,
                status="未收款",
                notes=f"由其他费用收入单 {head.income_code} 自动生成",
            ),
            created_by=operator_id,
            submit_review=False,
        )
        from apps.kuaicaiwu.services.finance_audit_workflow import submit_finance_review

        await submit_finance_review(
            model=Receivable,
            tenant_id=tenant_id,
            doc_id=int(receivable.id),
            updated_by=operator_id,
            doc_label="应收单",
            node_key="receivable",
        )
        receivable = await Receivable.get(id=int(receivable.id))
        await self._link_push(
            tenant_id=tenant_id,
            source_type="other_income",
            source_id=int(head.id),
            source_code=str(head.income_code),
            target_type="receivable",
            target_id=int(receivable.id),
            target_code=str(receivable.receivable_code),
            desc="其他费用收入生成应收单",
            created_by=operator_id,
        )
        return int(receivable.id), str(receivable.receivable_code)

    async def ensure_payable_on_expense_approved(
        self,
        tenant_id: int,
        head: OtherExpense,
        operator_id: int,
    ) -> Tuple[int, str]:
        kind = str(head.counterparty_kind or "").strip().lower()
        if kind != "supplier":
            raise ValidationError("其他费用支出审核通过须选择供应商往来，才能生成应付单")
        if not head.counterparty_id:
            raise ValidationError("其他费用支出须指定供应商")
        total = Decimal(str(head.total_amount or 0))
        if total <= 0:
            raise ValidationError("其他费用支出合计须大于 0")

        existing = await Payable.get_or_none(
            tenant_id=tenant_id,
            source_type=PAYABLE_SOURCE_OTHER_EXPENSE,
            source_id=int(head.id),
            deleted_at__isnull=True,
        )
        if existing:
            return int(existing.id), str(existing.payable_code)

        due_date = await resolve_partner_due_date(
            tenant_id, "supplier", int(head.counterparty_id), head.business_date
        )
        payable_svc = PayableService()
        payable = await payable_svc.create_payable(
            tenant_id=tenant_id,
            payable_data=PayableCreate(
                source_type=PAYABLE_SOURCE_OTHER_EXPENSE,
                source_id=int(head.id),
                source_code=str(head.expense_code),
                supplier_id=int(head.counterparty_id),
                supplier_name=str(head.counterparty_name or ""),
                total_amount=total,
                paid_amount=Decimal("0"),
                remaining_amount=total,
                due_date=due_date,
                business_date=head.business_date,
                status="未付款",
                notes=f"由其他费用支出单 {head.expense_code} 自动生成",
            ),
            created_by=operator_id,
            submit_review=False,
        )
        from apps.kuaicaiwu.services.finance_audit_workflow import submit_finance_review

        await submit_finance_review(
            model=Payable,
            tenant_id=tenant_id,
            doc_id=int(payable.id),
            updated_by=operator_id,
            doc_label="应付单",
            node_key="payable",
        )
        payable = await Payable.get(id=int(payable.id))
        await self._link_push(
            tenant_id=tenant_id,
            source_type="other_expense",
            source_id=int(head.id),
            source_code=str(head.expense_code),
            target_type="payable",
            target_id=int(payable.id),
            target_code=str(payable.payable_code),
            desc="其他费用支出生成应付单",
            created_by=operator_id,
        )
        return int(payable.id), str(payable.payable_code)

    async def get_receivable_for_income(
        self, tenant_id: int, income_id: int
    ) -> Optional[Receivable]:
        return await Receivable.get_or_none(
            tenant_id=tenant_id,
            source_type=RECEIVABLE_SOURCE_OTHER_INCOME,
            source_id=income_id,
            deleted_at__isnull=True,
        )

    async def get_payable_for_expense(
        self, tenant_id: int, expense_id: int
    ) -> Optional[Payable]:
        return await Payable.get_or_none(
            tenant_id=tenant_id,
            source_type=PAYABLE_SOURCE_OTHER_EXPENSE,
            source_id=expense_id,
            deleted_at__isnull=True,
        )

    async def finance_links_for_income(
        self, tenant_id: int, income_id: int
    ) -> Dict[str, Any]:
        receivable = await self.get_receivable_for_income(tenant_id, income_id)
        receipt_rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="other_income",
            source_id=income_id,
            target_type="receipt",
        ).first()
        return {
            "receivable_id": receivable.id if receivable else None,
            "receivable_code": receivable.receivable_code if receivable else None,
            "receipt_id": int(receipt_rel.target_id) if receipt_rel and receipt_rel.target_id else None,
            "receipt_code": receipt_rel.target_code if receipt_rel else None,
        }

    async def finance_links_for_expense(
        self, tenant_id: int, expense_id: int
    ) -> Dict[str, Any]:
        payable = await self.get_payable_for_expense(tenant_id, expense_id)
        payment_rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="other_expense",
            source_id=expense_id,
            target_type="payment",
        ).first()
        return {
            "payable_id": payable.id if payable else None,
            "payable_code": payable.payable_code if payable else None,
            "payment_id": int(payment_rel.target_id) if payment_rel and payment_rel.target_id else None,
            "payment_code": payment_rel.target_code if payment_rel else None,
        }

    async def void_receivable_for_income_revoke(
        self, tenant_id: int, income_id: int, operator_id: int
    ) -> None:
        receivable = await self.get_receivable_for_income(tenant_id, income_id)
        if not receivable:
            return
        from apps.kuaicaiwu.services.finance_service import ReceivableService

        await ReceivableService().delete_receivable(tenant_id, int(receivable.id))
        await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="other_income",
            source_id=income_id,
            target_type="receivable",
            target_id=int(receivable.id),
        ).delete()

    async def void_payable_for_expense_revoke(
        self, tenant_id: int, expense_id: int, operator_id: int
    ) -> None:
        payable = await self.get_payable_for_expense(tenant_id, expense_id)
        if not payable:
            return
        from apps.kuaicaiwu.services.finance_service import PayableService

        await PayableService().delete_payable(tenant_id, int(payable.id))
        await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="other_expense",
            source_id=expense_id,
            target_type="payable",
            target_id=int(payable.id),
        ).delete()

    async def assert_income_receivable_revokable(
        self, tenant_id: int, income_id: int
    ) -> None:
        receivable = await self.get_receivable_for_income(tenant_id, income_id)
        if not receivable:
            return
        received = Decimal(str(receivable.received_amount or 0))
        if received > 0 or str(receivable.status or "") in ("已结清", "部分收款"):
            raise BusinessLogicError("other_income.revoke.receivable_settled")
        rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="other_income",
            source_id=income_id,
            target_type="receipt",
        ).first()
        if rel:
            raise BusinessLogicError("other_income.revoke.receipt_exists")

    async def assert_expense_payable_revokable(
        self, tenant_id: int, expense_id: int
    ) -> None:
        payable = await self.get_payable_for_expense(tenant_id, expense_id)
        if not payable:
            return
        paid = Decimal(str(payable.paid_amount or 0))
        if paid > 0 or str(payable.status or "") in ("已结清", "部分付款"):
            raise BusinessLogicError("other_expense.revoke.payable_settled")
        rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="other_expense",
            source_id=expense_id,
            target_type="payment",
        ).first()
        if rel:
            raise BusinessLogicError("other_expense.revoke.payment_exists")

    async def link_income_receipt(
        self,
        tenant_id: int,
        income_id: int,
        income_code: str,
        receipt_id: int,
        receipt_code: str,
        created_by: int,
    ) -> None:
        await self._link_push(
            tenant_id=tenant_id,
            source_type="other_income",
            source_id=income_id,
            source_code=income_code,
            target_type="receipt",
            target_id=receipt_id,
            target_code=receipt_code,
            desc="其他费用收入确认收款",
            created_by=created_by,
        )

    async def link_expense_payment(
        self,
        tenant_id: int,
        expense_id: int,
        expense_code: str,
        payment_id: int,
        payment_code: str,
        created_by: int,
    ) -> None:
        await self._link_push(
            tenant_id=tenant_id,
            source_type="other_expense",
            source_id=expense_id,
            source_code=expense_code,
            target_type="payment",
            target_id=payment_id,
            target_code=payment_code,
            desc="其他费用支出确认付款",
            created_by=created_by,
        )

    @staticmethod
    async def _link_push(
        *,
        tenant_id: int,
        source_type: str,
        source_id: int,
        source_code: str,
        target_type: str,
        target_id: int,
        target_code: str,
        desc: str,
        created_by: int,
    ) -> None:
        exists = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
        ).first()
        if exists:
            return
        rel_svc = DocumentRelationNewService()
        await rel_svc.create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type=source_type,
                source_id=source_id,
                source_code=source_code,
                target_type=target_type,
                target_id=target_id,
                target_code=target_code,
                relation_type="source",
                relation_mode="push",
                relation_desc=desc,
            ),
            created_by=created_by,
        )
