import sys
import types
from datetime import date
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.api.finance import sales_invoices
from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService


class _UpdateQuery:
    def __init__(self):
        self.updated = {}

    async def update(self, **kwargs):
        self.updated.update(kwargs)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_invoice_auto_receivable_disabled_returns_none(monkeypatch):
    invoice = types.SimpleNamespace(
        id=1,
        invoice_code="SINV001",
        partner_id=100,
        partner_name="客户A",
        total_amount=Decimal("100.00"),
        invoice_date=date(2026, 3, 30),
        invoice_number="INV-001",
    )

    async def _disabled(_tenant_id):
        return False

    monkeypatch.setattr(
        sales_invoices.business_config_service,
        "get_finance_auto_generate_receivable_from_sales_invoice",
        _disabled,
    )

    receivable_id, receivable_code = await sales_invoices._maybe_auto_generate_receivable_for_sales_invoice(
        tenant_id=1,
        invoice=invoice,
        created_by=99,
    )
    assert receivable_id is None
    assert receivable_code is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_invoice_auto_receivable_enabled_creates_receivable(monkeypatch):
    invoice = types.SimpleNamespace(
        id=1,
        invoice_code="SINV001",
        partner_id=100,
        partner_name="客户A",
        total_amount=Decimal("100.00"),
        invoice_date=date(2026, 3, 30),
        invoice_number="INV-001",
    )

    async def _enabled(_tenant_id):
        return True

    async def _node_enabled(_tenant_id, _node_key):
        return True

    async def _fake_create_receivable(*, tenant_id, receivable_data, created_by):
        assert tenant_id == 1
        assert created_by == 99
        assert receivable_data.source_type == "SalesInvoice"
        assert receivable_data.total_amount == Decimal("100.00")
        return types.SimpleNamespace(id=10, receivable_code="YS202603300001")

    monkeypatch.setattr(
        sales_invoices.business_config_service,
        "get_finance_auto_generate_receivable_from_sales_invoice",
        _enabled,
    )
    monkeypatch.setattr(
        sales_invoices.business_config_service,
        "check_node_enabled",
        _node_enabled,
    )
    monkeypatch.setattr(
        sales_invoices.receivable_service,
        "create_receivable",
        _fake_create_receivable,
    )

    receivable_id, receivable_code = await sales_invoices._maybe_auto_generate_receivable_for_sales_invoice(
        tenant_id=1,
        invoice=invoice,
        created_by=99,
    )
    assert receivable_id == 10
    assert receivable_code == "YS202603300001"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_invoice_auto_payable_enabled_updates_invoice_link(monkeypatch):
    service = PurchaseInvoiceService()
    invoice = types.SimpleNamespace(
        id=2,
        invoice_code="PI202603300001",
        supplier_id=200,
        supplier_name="供应商A",
        total_amount=Decimal("123.00"),
        invoice_date=date(2026, 3, 30),
        invoice_number="PINV-001",
        payable_id=None,
        payable_code=None,
    )
    q = _UpdateQuery()

    async def _enabled(_tenant_id):
        return True

    async def _node_enabled(_tenant_id, _node_key):
        return True

    async def _fake_create_payable(self, *, tenant_id, payable_data, created_by):
        assert tenant_id == 1
        assert created_by == 99
        assert payable_data.source_type == "PurchaseInvoice"
        assert payable_data.total_amount == Decimal("123.00")
        return types.SimpleNamespace(id=20, payable_code="PY202603300001")

    monkeypatch.setattr(
        service.business_config_service,
        "get_finance_auto_generate_payable_from_purchase_invoice",
        _enabled,
    )
    monkeypatch.setattr(
        service.business_config_service,
        "check_node_enabled",
        _node_enabled,
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PayableService.create_payable",
        _fake_create_payable,
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.PurchaseInvoice.filter",
        lambda **_kwargs: q,
    )

    await service._maybe_auto_generate_payable_for_purchase_invoice(
        tenant_id=1,
        invoice=invoice,
        created_by=99,
    )

    assert invoice.payable_id == 20
    assert invoice.payable_code == "PY202603300001"
    assert q.updated["payable_id"] == 20
