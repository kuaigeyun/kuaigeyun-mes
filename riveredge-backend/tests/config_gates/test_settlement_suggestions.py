import sys
import types
from datetime import date
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.services.finance_service import AccountSettlementService


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def filter(self, **kwargs):
        rows = self._rows
        for key, value in kwargs.items():
            if key in {"customer_id", "supplier_id"}:
                rows = [r for r in rows if getattr(r, key) == value]
        return _FakeQuery(rows)

    def order_by(self, *_args):
        return self

    async def all(self):
        return self._rows


@pytest.mark.unit
def test_build_match_score_prefers_exact_amount_and_reference_overlap():
    service = AccountSettlementService()
    score_data = service._build_match_score(
        debit_amount=Decimal("100.00"),
        credit_amount=Decimal("100.00"),
        debit_date=date(2026, 3, 29),
        credit_date=date(2026, 3, 30),
        debit_ref="SO-2026-0001 INV-7788",
        credit_ref="银行回单 INV-7788",
        tolerance=Decimal("0.05"),
    )

    assert score_data["score"] >= 80
    assert "exact_amount" in score_data["reasons"]
    assert "ref_overlap" in score_data["reasons"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_suggest_receivable_matches_returns_ranked_items(monkeypatch):
    service = AccountSettlementService()

    receivables = [
        types.SimpleNamespace(
            id=1,
            customer_id=100,
            customer_name="客户A",
            receivable_code="YS001",
            source_code="SO-1001",
            invoice_number="INV-001",
            remaining_amount=Decimal("100.00"),
            business_date=date(2026, 3, 20),
        ),
        types.SimpleNamespace(
            id=2,
            customer_id=100,
            customer_name="客户A",
            receivable_code="YS002",
            source_code="SO-1002",
            invoice_number="INV-002",
            remaining_amount=Decimal("80.00"),
            business_date=date(2026, 3, 1),
        ),
    ]
    receipts = [
        types.SimpleNamespace(
            id=10,
            customer_id=100,
            receipt_code="SK001",
            unsettled_amount=Decimal("100.00"),
            receipt_date=date(2026, 3, 21),
            notes="回款 INV-001",
        ),
        types.SimpleNamespace(
            id=11,
            customer_id=100,
            receipt_code="SK002",
            unsettled_amount=Decimal("79.97"),
            receipt_date=date(2026, 3, 30),
            notes="无票据号",
        ),
    ]

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.Receivable.filter",
        lambda **_kwargs: _FakeQuery(receivables),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.Receipt.filter",
        lambda **_kwargs: _FakeQuery(receipts),
    )
    async def _fake_writeoff_limit(_tenant_id):
        return Decimal("0.05")

    monkeypatch.setattr(
        service.business_config_service,
        "get_finance_auto_write_off_precision_limit",
        _fake_writeoff_limit,
    )

    items = await service.suggest_receivable_matches(tenant_id=1, customer_id=100, limit=10)
    assert len(items) >= 1
    assert items[0]["receivable_id"] == 1
    assert items[0]["receipt_id"] == 10
    assert items[0]["confidence_score"] >= 70
    assert "exact_amount" in items[0]["reasons"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_suggest_payable_matches_filters_low_score(monkeypatch):
    service = AccountSettlementService()

    payables = [
        types.SimpleNamespace(
            id=1,
            supplier_id=200,
            supplier_name="供应商A",
            payable_code="PY001",
            source_code="PO-9001",
            invoice_number="PINV-001",
            remaining_amount=Decimal("100.00"),
            business_date=date(2026, 3, 1),
        ),
    ]
    payments = [
        types.SimpleNamespace(
            id=20,
            supplier_id=200,
            payment_code="FK001",
            unsettled_amount=Decimal("200.00"),
            payment_date=date(2026, 1, 1),
            notes="无关联",
        ),
    ]

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.Payable.filter",
        lambda **_kwargs: _FakeQuery(payables),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.Payment.filter",
        lambda **_kwargs: _FakeQuery(payments),
    )
    async def _fake_writeoff_limit(_tenant_id):
        return Decimal("0.05")

    monkeypatch.setattr(
        service.business_config_service,
        "get_finance_auto_write_off_precision_limit",
        _fake_writeoff_limit,
    )

    items = await service.suggest_payable_matches(tenant_id=1, supplier_id=200, limit=10)
    assert items == []
