"""
应收/应付合并收款（付款）与合并开票。

同往来单位多张源单 → 一张凭证 + 多笔核销/关联。
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Sequence, Tuple

from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit
from apps.kuaicaiwu.models.invoice import Invoice
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.schemas.finance import (
    MergeFinanceAllocationLine,
    MergePaymentCreate,
    MergePurchaseInvoiceCreate,
    MergeReceiptCreate,
    MergeSalesInvoiceCreate,
    PurchaseInvoiceCreate,
)
from apps.kuaicaiwu.services.finance_service import AccountSettlementService, PurchaseInvoiceService
from apps.kuaicaiwu.services.finance_tax import compute_tax_from_excluding
from apps.kuaicaiwu.services.payment_pull_service import PaymentPullService
from apps.kuaicaiwu.services.purchase_invoice_pull_service import PurchaseInvoicePullService
from apps.kuaicaiwu.services.receipt_pull_service import ReceiptPullService
from apps.kuaicaiwu.services.sales_invoice_service import SalesInvoiceService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError
from infra.models.user import User

_TWOPLACES = Decimal("0.01")


def _d(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def _normalize_allocations(
    allocations: Sequence[MergeFinanceAllocationLine],
) -> List[Tuple[int, Decimal]]:
    if not allocations:
        raise BusinessLogicError("请至少选择一张源单并填写分摊金额")
    seen: set[int] = set()
    out: List[Tuple[int, Decimal]] = []
    for line in allocations:
        sid = int(line.source_id)
        if sid in seen:
            raise BusinessLogicError(f"源单重复: {sid}")
        seen.add(sid)
        amount = _d(line.amount)
        if amount <= 0:
            raise BusinessLogicError(f"源单 {sid} 分摊金额须大于 0")
        out.append((sid, amount))
    return out


class MergeSettlementService:
    def __init__(self) -> None:
        self.receipt_pull = ReceiptPullService()
        self.payment_pull = PaymentPullService()
        self.sales_invoice = SalesInvoiceService()
        self.purchase_invoice_pull = PurchaseInvoicePullService()
        self.settlement = AccountSettlementService()
        self.purchase_invoice_svc = PurchaseInvoiceService()

    async def merge_create_receipt(
        self,
        tenant_id: int,
        data: MergeReceiptCreate,
        current_user: User,
    ) -> Dict[str, Any]:
        from apps.kuaicaiwu.services.bank_account_service import BankAccountService
        from infra.exceptions.exceptions import ValidationError as FinanceValidationError

        try:
            await BankAccountService().validate_voucher_account(
                tenant_id,
                payment_method=data.payment_method,
                bank_account_id=data.bank_account_id,
            )
        except FinanceValidationError as exc:
            raise BusinessLogicError(str(exc)) from exc

        lines = _normalize_allocations(data.allocations)
        previews: List[Dict[str, Any]] = []
        for sid, amount in lines:
            preview = await self.receipt_pull.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type="receivable",
                source_id=sid,
                total_amount=amount,
            )
            previews.append(preview)

        partner_ids = {int(p.get("customer_id") or 0) for p in previews}
        if len(partner_ids) != 1 or 0 in partner_ids:
            raise BusinessLogicError("合并收款仅支持同一客户的应收单")
        customer_id = next(iter(partner_ids))
        customer_name = str(previews[0].get("customer_name") or "")
        total_amount = sum((amt for _, amt in lines), Decimal("0")).quantize(_TWOPLACES)
        source_codes = [
            str(p.get("source_code") or "").strip()
            for p in previews
            if str(p.get("source_code") or "").strip()
        ]
        from apps.kuaicaiwu.services.bank_account_service import build_voucher_bank_summary

        today = today_site_str()
        count = await Receipt.filter(tenant_id=tenant_id).count()
        code = f"SK{today}{count + 1:04d}"
        merge_notes = (data.notes or "").strip() or build_voucher_bank_summary(
            voucher_kind="receipt",
            voucher_code=code,
            partner_name=customer_name,
            source_codes=source_codes,
        )
        biz_day = resolve_business_datetime()
        settlement_codes = [
            await self.settlement.generate_code(
                tenant_id, "SETTLEMENT_CODE", prefix=f"HX{biz_day.strftime('%Y%m%d')}"
            )
            for _ in lines
        ]

        async with in_transaction():
            receipt_payload = {
                "tenant_id": tenant_id,
                "receipt_code": code,
                "customer_id": customer_id,
                "customer_name": customer_name,
                "total_amount": total_amount,
                "settled_amount": 0,
                "unsettled_amount": total_amount,
                "receipt_date": data.receipt_date,
                "payment_method": data.payment_method,
                "bank_account": data.bank_account,
                "bank_account_id": data.bank_account_id,
                "settlement_type": data.settlement_type or "normal",
                "status": "Draft",
                "notes": merge_notes,
                "attachments": data.attachments,
            }
            apply_create_audit(receipt_payload, current_user)
            receipt = await Receipt.create(**receipt_payload)

            settled_pairs: List[Dict[str, Any]] = []
            for (sid, amount), preview, settlement_code in zip(lines, previews, settlement_codes):
                await self.receipt_pull.create_pull_relation(
                    tenant_id=tenant_id,
                    source_type="receivable",
                    source_id=sid,
                    source_code=str(preview.get("source_code") or ""),
                    receipt_id=int(receipt.id),
                    receipt_code=str(receipt.receipt_code),
                    created_by=current_user.id,
                )
                await self.settlement.apply_receivable_settlement(
                    tenant_id=tenant_id,
                    receivable_id=sid,
                    receipt_id=int(receipt.id),
                    amount=amount,
                    operator_id=current_user.id,
                    settlement_code=settlement_code,
                )
                settled_pairs.append(
                    {
                        "source_id": sid,
                        "source_code": preview.get("source_code"),
                        "amount": float(amount),
                    }
                )

            if data.bank_account_id:
                await BankAccountService().sync_from_confirmed_voucher(
                    tenant_id,
                    voucher_type="receipt",
                    voucher_id=int(receipt.id),
                    operator_id=current_user.id,
                )

        return {
            "voucher_type": "receipt",
            "voucher_id": int(receipt.id),
            "voucher_code": str(receipt.receipt_code),
            "total_amount": float(total_amount),
            "partner_id": customer_id,
            "partner_name": customer_name,
            "allocations": settled_pairs,
        }

    async def merge_create_payment(
        self,
        tenant_id: int,
        data: MergePaymentCreate,
        current_user: User,
    ) -> Dict[str, Any]:
        from apps.kuaicaiwu.services.bank_account_service import BankAccountService
        from infra.exceptions.exceptions import ValidationError as FinanceValidationError

        try:
            await BankAccountService().validate_voucher_account(
                tenant_id,
                payment_method=data.payment_method,
                bank_account_id=data.bank_account_id,
            )
        except FinanceValidationError as exc:
            raise BusinessLogicError(str(exc)) from exc

        lines = _normalize_allocations(data.allocations)
        previews: List[Dict[str, Any]] = []
        for sid, amount in lines:
            preview = await self.payment_pull.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type="payable",
                source_id=sid,
                total_amount=amount,
            )
            previews.append(preview)

        partner_ids = {int(p.get("supplier_id") or 0) for p in previews}
        if len(partner_ids) != 1 or 0 in partner_ids:
            raise BusinessLogicError("合并付款仅支持同一供应商的应付单")
        supplier_id = next(iter(partner_ids))
        supplier_name = str(previews[0].get("supplier_name") or "")
        total_amount = sum((amt for _, amt in lines), Decimal("0")).quantize(_TWOPLACES)
        source_codes = [
            str(p.get("source_code") or "").strip()
            for p in previews
            if str(p.get("source_code") or "").strip()
        ]
        from apps.kuaicaiwu.services.bank_account_service import build_voucher_bank_summary

        today = today_site_str()
        count = await Payment.filter(tenant_id=tenant_id).count()
        code = f"FK{today}{count + 1:04d}"
        merge_notes = (data.notes or "").strip() or build_voucher_bank_summary(
            voucher_kind="payment",
            voucher_code=code,
            partner_name=supplier_name,
            source_codes=source_codes,
        )
        biz_day = resolve_business_datetime()
        settlement_codes = [
            await self.settlement.generate_code(
                tenant_id, "SETTLEMENT_CODE", prefix=f"HX{biz_day.strftime('%Y%m%d')}"
            )
            for _ in lines
        ]

        async with in_transaction():
            payment_payload = {
                "tenant_id": tenant_id,
                "payment_code": code,
                "supplier_id": supplier_id,
                "supplier_name": supplier_name,
                "total_amount": total_amount,
                "settled_amount": 0,
                "unsettled_amount": total_amount,
                "payment_date": data.payment_date,
                "payment_method": data.payment_method,
                "bank_account": data.bank_account,
                "bank_account_id": data.bank_account_id,
                "settlement_type": data.settlement_type or "normal",
                "status": "Draft",
                "notes": merge_notes,
                "attachments": data.attachments,
            }
            apply_create_audit(payment_payload, current_user)
            payment = await Payment.create(**payment_payload)

            settled_pairs: List[Dict[str, Any]] = []
            for (sid, amount), preview, settlement_code in zip(lines, previews, settlement_codes):
                await self.payment_pull.create_pull_relation(
                    tenant_id=tenant_id,
                    source_type="payable",
                    source_id=sid,
                    source_code=str(preview.get("source_code") or ""),
                    payment_id=int(payment.id),
                    payment_code=str(payment.payment_code),
                    created_by=current_user.id,
                )
                await self.settlement.apply_payable_settlement(
                    tenant_id=tenant_id,
                    payable_id=sid,
                    payment_id=int(payment.id),
                    amount=amount,
                    operator_id=current_user.id,
                    settlement_code=settlement_code,
                )
                settled_pairs.append(
                    {
                        "source_id": sid,
                        "source_code": preview.get("source_code"),
                        "amount": float(amount),
                    }
                )

            if data.bank_account_id:
                await BankAccountService().sync_from_confirmed_voucher(
                    tenant_id,
                    voucher_type="payment",
                    voucher_id=int(payment.id),
                    operator_id=current_user.id,
                )

        return {
            "voucher_type": "payment",
            "voucher_id": int(payment.id),
            "voucher_code": str(payment.payment_code),
            "total_amount": float(total_amount),
            "partner_id": supplier_id,
            "partner_name": supplier_name,
            "allocations": settled_pairs,
        }

    async def merge_create_sales_invoice(
        self,
        tenant_id: int,
        data: MergeSalesInvoiceCreate,
        current_user: User,
    ) -> Dict[str, Any]:
        lines = _normalize_allocations(data.allocations)
        previews: List[Dict[str, Any]] = []
        for sid, amount in lines:
            preview = await self.sales_invoice.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type="receivable",
                source_id=sid,
                total_amount=amount,
            )
            previews.append(preview)

        partner_ids = {int(p.get("customer_id") or 0) for p in previews}
        if len(partner_ids) != 1 or 0 in partner_ids:
            raise BusinessLogicError("合并开票仅支持同一客户的应收单")
        customer_id = next(iter(partner_ids))
        customer_name = str(previews[0].get("customer_name") or "")
        total_with_tax = sum((amt for _, amt in lines), Decimal("0")).quantize(_TWOPLACES)

        tax_rate_pct = Decimal(str(data.tax_rate))
        if tax_rate_pct < 0:
            raise BusinessLogicError("税率不能为负")
        rate = tax_rate_pct / Decimal("100")
        if rate > 0:
            invoice_amount = (total_with_tax / (Decimal("1") + rate)).quantize(
                _TWOPLACES, rounding=ROUND_HALF_UP
            )
        else:
            invoice_amount = total_with_tax
        _, tax_amount, computed_total = compute_tax_from_excluding(invoice_amount, tax_rate_pct)
        if computed_total != total_with_tax:
            tax_amount = (total_with_tax - invoice_amount).quantize(_TWOPLACES)

        primary = previews[0]
        if len(lines) == 1:
            receivable_id = int(primary.get("receivable_id") or lines[0][0])
            receivable_code = str(primary.get("receivable_code") or primary.get("source_code") or "")
            source_document_code = receivable_code
        else:
            receivable_id = None
            receivable_code = None
            source_document_code = ",".join(
                str(p.get("source_code") or p.get("receivable_code") or sid)
                for (sid, _), p in zip(lines, previews)
            )[:100]

        code = await self.purchase_invoice_svc.generate_code(
            tenant_id, "SALES_INVOICE_CODE", prefix=f"SI{today_site_str()}"
        )

        async with in_transaction():
            create_payload = {
                "tenant_id": tenant_id,
                "invoice_code": code,
                "category": "OUT",
                "invoice_number": data.invoice_number or "",
                "invoice_date": data.invoice_date,
                "invoice_type": data.invoice_type or "增值税专用发票",
                "partner_id": customer_id,
                "partner_name": customer_name,
                "tax_rate": float(rate),
                "amount_excluding_tax": invoice_amount,
                "tax_amount": tax_amount,
                "total_amount": total_with_tax,
                "source_document_code": source_document_code,
                "receivable_id": receivable_id,
                "receivable_code": receivable_code,
                "description": data.notes,
                "status": "未审核",
            }
            apply_create_audit(create_payload, current_user)
            invoice = await Invoice.create(**create_payload)

            settled_pairs: List[Dict[str, Any]] = []
            for (sid, amount), preview in zip(lines, previews):
                await self.sales_invoice.create_pull_relation(
                    tenant_id=tenant_id,
                    source_type="receivable",
                    source_id=sid,
                    source_code=str(preview.get("source_code") or ""),
                    invoice_id=int(invoice.id),
                    invoice_code=str(invoice.invoice_code),
                    created_by=current_user.id,
                    allocated_amount=amount,
                )
                receivable_update: dict = {
                    "invoice_issued": True,
                    "updated_by": current_user.id,
                }
                if data.invoice_number:
                    receivable_update["invoice_number"] = data.invoice_number
                await Receivable.filter(tenant_id=tenant_id, id=sid).update(**receivable_update)
                settled_pairs.append(
                    {
                        "source_id": sid,
                        "source_code": preview.get("source_code"),
                        "amount": float(amount),
                    }
                )

        return {
            "voucher_type": "sales_invoice",
            "voucher_id": int(invoice.id),
            "voucher_code": str(invoice.invoice_code),
            "total_amount": float(total_with_tax),
            "partner_id": customer_id,
            "partner_name": customer_name,
            "allocations": settled_pairs,
        }

    async def merge_create_purchase_invoice(
        self,
        tenant_id: int,
        data: MergePurchaseInvoiceCreate,
        current_user: User,
    ) -> Dict[str, Any]:
        lines = _normalize_allocations(data.allocations)
        previews: List[Dict[str, Any]] = []
        for sid, amount in lines:
            preview = await self.purchase_invoice_pull.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type="payable",
                source_id=sid,
                total_amount=amount,
            )
            previews.append(preview)

        partner_ids = {int(p.get("supplier_id") or 0) for p in previews}
        if len(partner_ids) != 1 or 0 in partner_ids:
            raise BusinessLogicError("合并开票仅支持同一供应商的应付单")
        supplier_id = next(iter(partner_ids))
        supplier_name = str(previews[0].get("supplier_name") or "")
        total_with_tax = sum((amt for _, amt in lines), Decimal("0")).quantize(_TWOPLACES)

        tax_rate_pct = Decimal(str(data.tax_rate))
        if tax_rate_pct < 0:
            raise BusinessLogicError("税率不能为负")
        rate = tax_rate_pct / Decimal("100")
        if rate > 0:
            invoice_amount = (total_with_tax / (Decimal("1") + rate)).quantize(
                _TWOPLACES, rounding=ROUND_HALF_UP
            )
        else:
            invoice_amount = total_with_tax
        _, tax_amount, _ = compute_tax_from_excluding(invoice_amount, tax_rate_pct)
        if (invoice_amount + tax_amount).quantize(_TWOPLACES) != total_with_tax:
            tax_amount = (total_with_tax - invoice_amount).quantize(_TWOPLACES)

        primary = previews[0]
        if len(lines) == 1:
            payable_id = int(primary.get("payable_id") or lines[0][0])
            payable_code = str(primary.get("payable_code") or primary.get("source_code") or "")
        else:
            payable_id = int(primary.get("payable_id") or lines[0][0])
            payable_code = None

        create_data = PurchaseInvoiceCreate(
            supplier_id=supplier_id,
            supplier_name=supplier_name,
            invoice_number=data.invoice_number,
            invoice_date=data.invoice_date,
            invoice_type=data.invoice_type or "增值税专用发票",
            tax_rate=tax_rate_pct,
            invoice_amount=invoice_amount,
            tax_amount=tax_amount,
            total_amount=total_with_tax,
            payable_id=payable_id if len(lines) == 1 else None,
            payable_code=payable_code,
            notes=data.notes,
            source_type="payable" if len(lines) == 1 else None,
            source_id=payable_id if len(lines) == 1 else None,
        )

        allocated_code = await self.purchase_invoice_svc.generate_code(
            tenant_id, "PURCHASE_INVOICE_CODE", prefix=f"PI{today_site_str()}"
        )

        async with in_transaction():
            invoice = await self.purchase_invoice_svc.create_purchase_invoice(
                tenant_id,
                create_data,
                current_user.id,
                skip_legacy_amount_gate=True,
                submit_review=False,
                invoice_code=allocated_code,
            )
            invoice_id = int(invoice.id)
            update_fields: Dict[str, Any] = {
                "invoice_amount": invoice_amount,
                "tax_amount": tax_amount,
                "total_amount": total_with_tax,
            }
            if len(lines) > 1:
                update_fields["payable_id"] = None
                update_fields["payable_code"] = None
            await PurchaseInvoice.filter(tenant_id=tenant_id, id=invoice_id).update(**update_fields)

            settled_pairs: List[Dict[str, Any]] = []
            for (sid, amount), preview in zip(lines, previews):
                await self.purchase_invoice_pull.create_pull_relation(
                    tenant_id=tenant_id,
                    source_type="payable",
                    source_id=sid,
                    source_code=str(preview.get("source_code") or ""),
                    invoice_id=invoice_id,
                    invoice_code=str(invoice.invoice_code),
                    created_by=current_user.id,
                    allocated_amount=amount,
                )
                payable_update: dict = {
                    "invoice_received": True,
                    "updated_by": current_user.id,
                }
                if data.invoice_number:
                    payable_update["invoice_number"] = data.invoice_number
                await Payable.filter(tenant_id=tenant_id, id=sid).update(**payable_update)
                settled_pairs.append(
                    {
                        "source_id": sid,
                        "source_code": preview.get("source_code"),
                        "amount": float(amount),
                    }
                )

        return {
            "voucher_type": "purchase_invoice",
            "voucher_id": invoice_id,
            "voucher_code": str(invoice.invoice_code),
            "total_amount": float(total_with_tax),
            "partner_id": supplier_id,
            "partner_name": supplier_name,
            "allocations": settled_pairs,
        }
