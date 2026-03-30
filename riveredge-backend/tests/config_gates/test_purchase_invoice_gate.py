import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.schemas.finance import PurchaseInvoiceCreate
from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService
from infra.exceptions.exceptions import ValidationError


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    async def all(self):
        return self._rows


class _Row:
    def __init__(self, total_amount):
        self.total_amount = total_amount


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_invoice_gate_allows_within_received_amount(monkeypatch):
    service = PurchaseInvoiceService()
    invoice_data = PurchaseInvoiceCreate(
        purchase_order_id=100,
        purchase_order_code="PO-100",
        supplier_id=1,
        supplier_name="供应商A",
        invoice_number="INV-100",
        invoice_date="2026-03-30",
        invoice_type="增值税专用发票",
        tax_rate="13",
        invoice_amount="100",
        tax_amount="13",
        total_amount="113",
    )

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PurchaseReceipt.filter",
        lambda **_kwargs: _FakeQuery([_Row(Decimal("200.00"))]),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PurchaseInvoice.filter",
        lambda **_kwargs: _FakeQuery([_Row(Decimal("50.00"))]),
    )

    await service._validate_purchase_invoice_amount_gate(tenant_id=1, invoice_data=invoice_data)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_invoice_gate_blocks_exceed_received_amount(monkeypatch):
    service = PurchaseInvoiceService()
    invoice_data = PurchaseInvoiceCreate(
        purchase_order_id=100,
        purchase_order_code="PO-100",
        supplier_id=1,
        supplier_name="供应商A",
        invoice_number="INV-101",
        invoice_date="2026-03-30",
        invoice_type="增值税专用发票",
        tax_rate="13",
        invoice_amount="300",
        tax_amount="39",
        total_amount="339",
    )

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PurchaseReceipt.filter",
        lambda **_kwargs: _FakeQuery([_Row(Decimal("200.00"))]),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PurchaseInvoice.filter",
        lambda **_kwargs: _FakeQuery([_Row(Decimal("50.00"))]),
    )

    with pytest.raises(ValidationError):
        await service._validate_purchase_invoice_amount_gate(tenant_id=1, invoice_data=invoice_data)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_invoice_gate_skips_when_no_purchase_order(monkeypatch):
    service = PurchaseInvoiceService()
    invoice_data = PurchaseInvoiceCreate(
        supplier_id=1,
        supplier_name="供应商A",
        invoice_number="INV-102",
        invoice_date="2026-03-30",
        invoice_type="增值税专用发票",
        tax_rate="13",
        invoice_amount="100",
        tax_amount="13",
        total_amount="113",
    )

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PurchaseReceipt.filter",
        lambda **_kwargs: _FakeQuery([]),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PurchaseInvoice.filter",
        lambda **_kwargs: _FakeQuery([]),
    )

    await service._validate_purchase_invoice_amount_gate(tenant_id=1, invoice_data=invoice_data)
