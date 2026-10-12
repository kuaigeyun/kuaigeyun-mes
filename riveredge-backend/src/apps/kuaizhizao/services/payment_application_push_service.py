"""
付款申请下推付款单
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.services.payment_pull_service import PaymentPullService
from apps.kuaizhizao.models.payment_application import PaymentApplication, PaymentApplicationLine
from apps.kuaizhizao.schemas.payment_application import PushPaymentApplicationToPaymentRequest
from apps.kuaizhizao.services.document_action_policy.payment_application import (
    assert_payment_application_capability,
)
from apps.kuaizhizao.services.payment_application_service import PaymentApplicationService
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError
from infra.models.user import User


class PaymentApplicationPushService:
    def __init__(self) -> None:
        self._app_svc = PaymentApplicationService()
        self._payment_pull = PaymentPullService()

    async def push_to_payment(
        self,
        tenant_id: int,
        application_id: int,
        data: PushPaymentApplicationToPaymentRequest,
        current_user: User,
    ) -> dict:
        app = await PaymentApplication.get_or_none(
            tenant_id=tenant_id, id=application_id, deleted_at__isnull=True
        )
        if not app:
            raise NotFoundError(f"付款申请单不存在: {application_id}")
        assert_payment_application_capability(app, "push_payment")

        line_query = PaymentApplicationLine.filter(
            tenant_id=tenant_id, application_id=application_id
        ).order_by("line_no")
        if data.line_ids:
            line_query = line_query.filter(id__in=data.line_ids)
        lines = await line_query.all()
        if not lines:
            raise ValidationError("无可用申请行")

        pay_lines: List[tuple[PaymentApplicationLine, Decimal]] = []
        prepay_lines: List[tuple[PaymentApplicationLine, Decimal]] = []
        for line in lines:
            open_amt = Decimal(str(line.request_amount or 0)) - Decimal(str(line.paid_amount or 0))
            if open_amt <= 0:
                continue
            if str(line.line_kind) == "prepayment" or not line.payable_id:
                prepay_lines.append((line, open_amt))
            else:
                pay_lines.append((line, open_amt))

        if prepay_lines and pay_lines:
            raise BusinessLogicError("预付行与货款行请分开下推付款单")
        if not prepay_lines and not pay_lines:
            raise BusinessLogicError("所选行已无待付款金额")

        settlement_type = "prepayment" if prepay_lines else "normal"
        total = sum(amt for _, amt in (prepay_lines or pay_lines))

        from apps.kuaicaiwu.services.finance_voucher_codes import allocate_payment_code
        from apps.kuaicaiwu.services.bank_account_service import BankAccountService

        payment_method = data.payment_method or "银行转账"
        await BankAccountService().validate_voucher_account(
            tenant_id,
            payment_method=payment_method,
            bank_account_id=data.bank_account_id,
        )

        pay_date = data.payment_date or to_site_date(resolve_business_datetime())
        code = await allocate_payment_code(tenant_id)
        notes = (data.notes or "").strip() or f"由付款申请 {app.application_code} 下推"

        async with in_transaction():
            payload = {
                "tenant_id": tenant_id,
                "payment_code": code,
                "supplier_id": app.supplier_id,
                "supplier_name": app.supplier_name,
                "total_amount": total,
                "settled_amount": Decimal("0"),
                "unsettled_amount": total,
                "payment_date": pay_date,
                "payment_method": payment_method,
                "bank_account_id": data.bank_account_id,
                "settlement_type": settlement_type,
                "status": "Draft",
                "notes": notes,
            }
            apply_create_audit(payload, current_user)
            payment = await Payment.create(**payload)

            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="payment_application",
                    source_id=application_id,
                    source_code=app.application_code,
                    target_type="payment",
                    target_id=int(payment.id),
                    target_code=payment.payment_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="付款申请下推付款单",
                ),
                created_by=current_user.id,
            )

            line_payments: List[tuple[int, Decimal]] = []
            if settlement_type == "normal":
                for line, amt in pay_lines:
                    await self._payment_pull.create_pull_relation(
                        tenant_id=tenant_id,
                        source_type="payable",
                        source_id=int(line.payable_id),
                        source_code=str(line.payable_code or ""),
                        payment_id=int(payment.id),
                        payment_code=str(payment.payment_code),
                        created_by=current_user.id,
                    )
                    line_payments.append((int(line.id), amt))
            else:
                for line, amt in prepay_lines:
                    if line.source_type == "purchase_order" and line.source_id:
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="purchase_order",
                                source_id=int(line.source_id),
                                source_code=str(line.source_code or ""),
                                target_type="payment",
                                target_id=int(payment.id),
                                target_code=payment.payment_code,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="预付付款申请关联订单",
                            ),
                            created_by=current_user.id,
                        )
                    line_payments.append((int(line.id), amt))

        # 已付回写在付款单确认时执行（见 payment_application_payment_hooks）

        return {
            "application_id": application_id,
            "application_code": app.application_code,
            "payment_id": payment.id,
            "payment_code": payment.payment_code,
            "total_amount": float(total),
            "settlement_type": settlement_type,
        }

    async def apply_payment_confirmed(
        self,
        tenant_id: int,
        payment_id: int,
        operator_id: int,
    ) -> None:
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payment_application",
            target_type="payment",
            target_id=payment_id,
        ).first()
        if not rel or not rel.source_id:
            return
        app_id = int(rel.source_id)
        lines = await PaymentApplicationLine.filter(
            tenant_id=tenant_id, application_id=app_id
        ).all()
        payment = await Payment.get_or_none(tenant_id=tenant_id, id=payment_id)
        if not payment:
            return
        pay_total = Decimal(str(payment.total_amount or 0))
        line_payments: List[tuple[int, Decimal]] = []
        if str(payment.settlement_type) == "prepayment":
            for line in lines:
                open_amt = Decimal(str(line.request_amount or 0)) - Decimal(
                    str(line.paid_amount or 0)
                )
                if open_amt > 0 and str(line.line_kind) == "prepayment":
                    line_payments.append((int(line.id), min(open_amt, pay_total)))
                    break
        else:
            for line in lines:
                if not line.payable_id:
                    continue
                open_amt = Decimal(str(line.request_amount or 0)) - Decimal(
                    str(line.paid_amount or 0)
                )
                if open_amt > 0:
                    line_payments.append((int(line.id), open_amt))
        if line_payments:
            await self._app_svc.record_line_paid(tenant_id, app_id, line_payments)
