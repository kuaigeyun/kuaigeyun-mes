import json
import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.services.finance_service import (
    AccountSettlementService,
    PayableService,
    ReceivableService,
)


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    async def all(self):
        return self._rows


@pytest.mark.unit
@pytest.mark.asyncio
async def test_payable_amount_audit_logs_before_after(monkeypatch):
    captured = {}

    async def _fake_create_operation_log(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.OperationLogService.create_operation_log",
        _fake_create_operation_log,
    )

    service = PayableService()
    await service._log_payable_amount_audit(
        tenant_id=1,
        payable_id=10,
        operator_id=99,
        before_paid=Decimal("1.00"),
        before_remaining=Decimal("9.00"),
        after_paid=Decimal("2.00"),
        after_remaining=Decimal("8.00"),
        scene="record_payment",
    )

    assert captured["tenant_id"] == 1
    assert captured["operation_object_type"] == "PayableAmountAudit"
    body = json.loads(captured["operation_content"])
    assert body["scene"] == "record_payment"
    assert body["before"]["paid_amount"] == "1.00"
    assert body["after"]["remaining_amount"] == "8.00"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_receivable_amount_audit_logs_before_after(monkeypatch):
    captured = {}

    async def _fake_create_operation_log(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.OperationLogService.create_operation_log",
        _fake_create_operation_log,
    )

    service = ReceivableService()
    await service._log_receivable_amount_audit(
        tenant_id=1,
        receivable_id=20,
        operator_id=88,
        before_received=Decimal("3.00"),
        before_remaining=Decimal("7.00"),
        after_received=Decimal("4.00"),
        after_remaining=Decimal("6.00"),
        scene="record_receipt",
    )

    assert captured["tenant_id"] == 1
    assert captured["operation_object_type"] == "ReceivableAmountAudit"
    body = json.loads(captured["operation_content"])
    assert body["scene"] == "record_receipt"
    assert body["before"]["received_amount"] == "3.00"
    assert body["after"]["remaining_amount"] == "6.00"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_settlement_amount_audit_logs_before_after(monkeypatch):
    captured = {}

    async def _fake_create_operation_log(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.OperationLogService.create_operation_log",
        _fake_create_operation_log,
    )

    service = AccountSettlementService()
    await service._log_settlement_amount_audit(
        tenant_id=1,
        operator_id=77,
        object_type="Receivable",
        object_id=30,
        scene="settle_receivable",
        before={"received_amount": Decimal("1.00"), "remaining_amount": Decimal("9.00")},
        after={"received_amount": Decimal("5.00"), "remaining_amount": Decimal("5.00")},
    )

    assert captured["tenant_id"] == 1
    assert captured["operation_object_type"] == "ReceivableAmountAudit"
    body = json.loads(captured["operation_content"])
    assert body["scene"] == "settle_receivable"
    assert body["before"]["remaining_amount"] == "9.00"
    assert body["after"]["received_amount"] == "5.00"


@pytest.mark.unit
def test_settlement_rounding_writeoff_limit_applied():
    service = AccountSettlementService()
    # 限额内自动冲平
    adjusted, applied = service._apply_rounding_writeoff_value(
        value=Decimal("0.03"),
        limit=Decimal("0.05"),
    )
    assert adjusted == Decimal("0.00")
    assert applied is True

    # 超限不冲平
    adjusted, applied = service._apply_rounding_writeoff_value(
        value=Decimal("0.08"),
        limit=Decimal("0.05"),
    )
    assert adjusted == Decimal("0.08")
    assert applied is False


@pytest.mark.unit
def test_settlement_fx_snapshot_for_receivable_and_payable():
    service = AccountSettlementService()

    receivable_fx = service._build_fx_snapshot(
        amount=Decimal("100"),
        invoice_exchange_rate=Decimal("7.20"),
        payment_exchange_rate=Decimal("7.25"),
        business_type="receivable",
        currency="USD",
    )
    assert receivable_fx is not None
    assert receivable_fx["result"] == "gain"
    assert receivable_fx["fx_gain"] == "5.00"
    assert receivable_fx["fx_loss"] == "0.00"

    payable_fx = service._build_fx_snapshot(
        amount=Decimal("100"),
        invoice_exchange_rate=Decimal("7.20"),
        payment_exchange_rate=Decimal("7.25"),
        business_type="payable",
        currency="USD",
    )
    assert payable_fx is not None
    assert payable_fx["result"] == "loss"
    assert payable_fx["fx_gain"] == "0.00"
    assert payable_fx["fx_loss"] == "5.00"


@pytest.mark.unit
def test_period_end_fx_delta_for_receivable_and_payable():
    service = AccountSettlementService()
    receivable_delta = service._build_period_end_fx_delta(
        amount=Decimal("100"),
        book_rate=Decimal("7.20"),
        period_end_rate=Decimal("7.25"),
        business_type="receivable",
    )
    assert receivable_delta["fx_gain"] == Decimal("5.00")
    assert receivable_delta["fx_loss"] == Decimal("0.00")

    payable_delta = service._build_period_end_fx_delta(
        amount=Decimal("100"),
        book_rate=Decimal("7.20"),
        period_end_rate=Decimal("7.25"),
        business_type="payable",
    )
    assert payable_delta["fx_gain"] == Decimal("0.00")
    assert payable_delta["fx_loss"] == Decimal("5.00")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revaluate_period_end_generates_lines_and_events(monkeypatch):
    service = AccountSettlementService()
    events = []
    receivables = [types.SimpleNamespace(id=1, receivable_code="YS001", remaining_amount=Decimal("100.00"))]
    payables = [types.SimpleNamespace(id=2, payable_code="PY001", remaining_amount=Decimal("80.00"))]

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.Receivable.filter",
        lambda **_kwargs: _FakeQuery(receivables),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.finance_service.Payable.filter",
        lambda **_kwargs: _FakeQuery(payables),
    )

    async def _fake_record_event(**kwargs):
        events.append(kwargs)
        return None

    monkeypatch.setattr(service.accounting_event_service, "record_event", _fake_record_event)

    result = await service.revaluate_period_end(
        tenant_id=1,
        operator_id=99,
        period="2026-03",
        currency="USD",
        book_rate=Decimal("7.20"),
        period_end_rate=Decimal("7.25"),
        doc_type="all",
    )

    assert result["line_count"] == 2
    assert result["total_fx_gain"] == "5.00"
    assert result["total_fx_loss"] == "4.00"
    assert len(events) == 2
