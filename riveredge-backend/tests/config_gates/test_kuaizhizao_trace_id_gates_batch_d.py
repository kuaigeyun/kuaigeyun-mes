import sys
import types
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))
if "inngest" not in sys.modules:
    _inngest_module = types.ModuleType("inngest")
    class _InngestStub:  # pragma: no cover - import stub
        def __init__(self, *args, **kwargs):
            pass
    class _EventStub:  # pragma: no cover - import stub
        def __init__(self, *args, **kwargs):
            pass
    _inngest_module.Inngest = _InngestStub
    _inngest_module.Event = _EventStub
    sys.modules["inngest"] = _inngest_module

from apps.kuaizhizao.api.customer_follow_ups import customer_follow_ups
from apps.kuaizhizao.api.purchase_requisitions import purchase_requisitions
from apps.kuaizhizao.api.maintenance_reminders import maintenance_reminders
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError


@pytest.mark.unit
@pytest.mark.asyncio
async def test_customer_follow_ups_create_should_map_validation_error_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad follow-up payload")

    monkeypatch.setattr(customer_follow_ups._service, "create", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await customer_follow_ups.create_follow_up(
            body=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad follow-up payload"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_requisition_convert_should_map_business_error_with_trace_id(monkeypatch):
    async def _raise_business_error(*args, **kwargs):
        raise BusinessLogicError("requisition can not convert")

    monkeypatch.setattr(
        "apps.kuaizhizao.services.purchase_requisition_service.PurchaseRequisitionService.convert_to_purchase_order",
        _raise_business_error,
    )

    with pytest.raises(HTTPException) as exc:
        await purchase_requisitions.convert_to_purchase_order(
            data=None,
            requisition_id=1,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "requisition can not convert"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_maintenance_reminders_mark_handled_should_map_not_found_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("reminder missing")

    monkeypatch.setattr(
        "apps.kuaizhizao.services.maintenance_reminder_service.MaintenanceReminderService.mark_as_handled",
        _raise_not_found,
    )

    with pytest.raises(HTTPException) as exc:
        await maintenance_reminders.mark_reminder_as_handled(
            data=SimpleNamespace(reminder_uuid="r-1", remark=None),
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "reminder missing" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")
