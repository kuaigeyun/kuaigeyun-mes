import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.schemas.finance import (
    PayableCreate,
    PaymentRecordCreate,
    ReceivableCreate,
    ReceiptRecordCreate,
    SalesInvoiceCreate,
)
from apps.kuaicaiwu.services.finance_service import PayableService, ReceivableService


@pytest.mark.unit
def test_finance_money_fields_use_decimal_types():
    payable = PayableCreate(
        source_type="PO",
        source_id=1,
        source_code="PO-001",
        supplier_id=10,
        supplier_name="供应商A",
        total_amount="0.30",
        paid_amount="0.10",
        remaining_amount="0.20",
        due_date="2026-03-30",
        business_date="2026-03-30",
    )
    receivable = ReceivableCreate(
        source_type="SO",
        source_id=2,
        source_code="SO-001",
        customer_id=20,
        customer_name="客户A",
        total_amount="0.30",
        received_amount="0.10",
        remaining_amount="0.20",
        due_date="2026-03-30",
        business_date="2026-03-30",
    )

    assert isinstance(payable.total_amount, Decimal)
    assert isinstance(receivable.total_amount, Decimal)
    assert payable.total_amount - payable.paid_amount == payable.remaining_amount
    assert receivable.total_amount - receivable.received_amount == receivable.remaining_amount


@pytest.mark.unit
def test_payment_and_receipt_record_amounts_are_decimal():
    payment = PaymentRecordCreate(
        payable_id=1,
        payment_amount="0.10",
        payment_date="2026-03-30",
        payment_method="银行转账",
    )
    receipt = ReceiptRecordCreate(
        receivable_id=1,
        receipt_amount="0.20",
        receipt_date="2026-03-30",
        receipt_method="银行转账",
    )

    assert isinstance(payment.payment_amount, Decimal)
    assert isinstance(receipt.receipt_amount, Decimal)
    assert payment.payment_amount + receipt.receipt_amount == Decimal("0.30")


@pytest.mark.unit
def test_sales_invoice_uses_decimal_for_amount_and_tax_rate():
    invoice = SalesInvoiceCreate(
        customer_id=1,
        customer_name="客户B",
        invoice_number="INV-001",
        invoice_date="2026-03-30",
        invoice_amount="100.10",
        tax_amount="13.01",
        total_amount="113.11",
    )

    assert isinstance(invoice.tax_rate, Decimal)
    assert isinstance(invoice.total_amount, Decimal)
    assert invoice.invoice_amount + invoice.tax_amount == invoice.total_amount


@pytest.mark.unit
def test_service_money_rounding_uses_two_decimal_places():
    payable_service = PayableService()
    receivable_service = ReceivableService()

    assert payable_service._money(Decimal("0.1") + Decimal("0.2")) == Decimal("0.30")
    assert receivable_service._money(Decimal("10.005")) == Decimal("10.00")
