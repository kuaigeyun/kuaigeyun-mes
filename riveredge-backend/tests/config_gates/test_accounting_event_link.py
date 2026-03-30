import sys
import types
from datetime import date
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.services.accounting_event_service import AccountingEventService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_accounting_event_record_event_persists_link_fields(monkeypatch):
    captured = {}

    async def _fake_create(**kwargs):
        captured.update(kwargs)
        return types.SimpleNamespace(**kwargs)

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.accounting_event_service.AccountingEvent.create",
        _fake_create,
    )

    result = await AccountingEventService.record_event(
        tenant_id=1,
        event_type="SETTLEMENT_RECEIVABLE_COMPLETED",
        business_type="settlement",
        source_doc_type="Receivable",
        source_doc_id=10,
        source_doc_code="YS20260330001",
        target_doc_type="Settlement",
        target_doc_id=20,
        target_doc_code="HX20260330001",
        amount=Decimal("100.50"),
        currency="USD",
        operator_id=99,
        operator_name="tester",
        payload={"fx": {"result": "gain"}},
    )

    assert captured["tenant_id"] == 1
    assert captured["event_type"] == "SETTLEMENT_RECEIVABLE_COMPLETED"
    assert captured["source_doc_type"] == "Receivable"
    assert captured["target_doc_type"] == "Settlement"
    assert captured["amount"] == Decimal("100.50")
    assert captured["currency"] == "USD"
    assert captured["payload"]["fx"]["result"] == "gain"
    assert captured["event_code"].startswith("AE-")
    assert len(captured["event_code"]) == 15
    assert captured["event_date"] == date.today()
    assert result.event_code == captured["event_code"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_accounting_event_record_event_generates_unique_event_codes(monkeypatch):
    codes = []

    async def _fake_create(**kwargs):
        codes.append(kwargs["event_code"])
        return types.SimpleNamespace(**kwargs)

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.accounting_event_service.AccountingEvent.create",
        _fake_create,
    )

    await AccountingEventService.record_event(
        tenant_id=1,
        event_type="PAYABLE_CREATED",
        business_type="payable",
    )
    await AccountingEventService.record_event(
        tenant_id=1,
        event_type="RECEIVABLE_CREATED",
        business_type="receivable",
    )

    assert len(codes) == 2
    assert codes[0] != codes[1]
