"""
开票同时收款/付款：在销项/进项发票创建成功后，按应收/应付拉单规则生成并核销收付款单。
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.services.bank_account_service import BankAccountService
from apps.kuaicaiwu.services.finance_voucher_posting_service import FinanceVoucherPostingService
from apps.kuaicaiwu.services.payment_pull_service import PaymentPullService
from apps.kuaicaiwu.services.receipt_pull_service import ReceiptPullService
from core.utils.timezone_utils import today_site_str
from apps.common.audit_actor import apply_create_audit
from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from infra.models.user import User


async def create_concurrent_receipt_for_receivable(
    *,
    tenant_id: int,
    receivable_id: int,
    total_amount: Decimal,
    payment_method: str,
    bank_account_id: Optional[int],
    bank_account: Optional[str],
    receipt_date: date,
    notes: Optional[str],
    current_user: User,
) -> int:
    """从应收单创建收款单并核销（与收款拉单创建一致）。"""
    amount = Decimal(str(total_amount or 0))
    if amount <= 0:
        raise BusinessLogicError("同时收款金额须大于 0")

    try:
        await BankAccountService().validate_voucher_account(
            tenant_id,
            payment_method=payment_method,
            bank_account_id=bank_account_id,
        )
    except ValidationError as exc:
        raise BusinessLogicError(str(exc)) from exc

    pull_svc = ReceiptPullService()
    pull_preview = await pull_svc.assert_pull_create_allowed(
        tenant_id=tenant_id,
        source_type="receivable",
        source_id=int(receivable_id),
        total_amount=amount,
    )

    today = today_site_str()
    count = await Receipt.filter(tenant_id=tenant_id).count()
    code = f"SK{today}{count + 1:04d}"
    customer_id = int(pull_preview.get("customer_id") or 0)
    customer_name = str(pull_preview.get("customer_name") or "")

    receipt_payload: dict[str, Any] = {
        "tenant_id": tenant_id,
        "receipt_code": code,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "total_amount": amount,
        "settled_amount": 0,
        "unsettled_amount": amount,
        "receipt_date": receipt_date,
        "payment_method": payment_method,
        "bank_account": bank_account,
        "bank_account_id": bank_account_id,
        "settlement_type": "normal",
        "status": "Draft",
        "notes": notes,
        "attachments": None,
    }
    apply_create_audit(receipt_payload, current_user)
    receipt = await Receipt.create(**receipt_payload)

    await pull_svc.create_pull_relation(
        tenant_id=tenant_id,
        source_type="receivable",
        source_id=int(receivable_id),
        source_code=str(pull_preview.get("source_code") or ""),
        receipt_id=int(receipt.id),
        receipt_code=str(receipt.receipt_code),
        created_by=current_user.id,
    )
    await FinanceVoucherPostingService().post_receipt(
        tenant_id,
        int(receipt.id),
        operator=current_user,
    )
    return int(receipt.id)


async def create_concurrent_payment_for_payable(
    *,
    tenant_id: int,
    payable_id: int,
    total_amount: Decimal,
    payment_method: str,
    bank_account_id: Optional[int],
    bank_account: Optional[str],
    payment_date: date,
    notes: Optional[str],
    current_user: User,
) -> int:
    """从应付单创建付款单并核销（与付款拉单创建一致）。"""
    amount = Decimal(str(total_amount or 0))
    if amount <= 0:
        raise BusinessLogicError("同时付款金额须大于 0")

    try:
        await BankAccountService().validate_voucher_account(
            tenant_id,
            payment_method=payment_method,
            bank_account_id=bank_account_id,
        )
    except ValidationError as exc:
        raise BusinessLogicError(str(exc)) from exc

    pull_svc = PaymentPullService()
    pull_preview = await pull_svc.assert_pull_create_allowed(
        tenant_id=tenant_id,
        source_type="payable",
        source_id=int(payable_id),
        total_amount=amount,
    )

    today = today_site_str()
    count = await Payment.filter(tenant_id=tenant_id).count()
    code = f"PK{today}{count + 1:04d}"
    supplier_id = int(pull_preview.get("supplier_id") or 0)
    supplier_name = str(pull_preview.get("supplier_name") or "")

    payment_payload: dict[str, Any] = {
        "tenant_id": tenant_id,
        "payment_code": code,
        "supplier_id": supplier_id,
        "supplier_name": supplier_name,
        "total_amount": amount,
        "settled_amount": 0,
        "unsettled_amount": amount,
        "payment_date": payment_date,
        "payment_method": payment_method,
        "bank_account": bank_account,
        "bank_account_id": bank_account_id,
        "settlement_type": "normal",
        "status": "Draft",
        "notes": notes,
        "attachments": None,
    }
    apply_create_audit(payment_payload, current_user)
    payment = await Payment.create(**payment_payload)

    await pull_svc.create_pull_relation(
        tenant_id=tenant_id,
        source_type="payable",
        source_id=int(payable_id),
        source_code=str(pull_preview.get("source_code") or ""),
        payment_id=int(payment.id),
        payment_code=str(payment.payment_code),
        created_by=current_user.id,
    )
    await FinanceVoucherPostingService().post_payment(
        tenant_id,
        int(payment.id),
        operator=current_user,
    )
    return int(payment.id)
