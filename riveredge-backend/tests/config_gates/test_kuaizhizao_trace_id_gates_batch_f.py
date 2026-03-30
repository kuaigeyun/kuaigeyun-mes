import importlib.util
from pathlib import Path
import sys
import types

import pytest
from fastapi import HTTPException

from infra.exceptions.exceptions import BusinessLogicError, NotFoundError

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))


_base_api_dir = Path(__file__).resolve().parents[2] / "src/apps/kuaizhizao/api"

_quality_exec_spec = importlib.util.spec_from_file_location(
    "config_gate_quality_execution_api", _base_api_dir / "productions/quality_execution.py"
)
quality_exec_api = importlib.util.module_from_spec(_quality_exec_spec)
assert _quality_exec_spec and _quality_exec_spec.loader
_quality_exec_spec.loader.exec_module(quality_exec_api)

_receipt_notice_spec = importlib.util.spec_from_file_location(
    "config_gate_receipt_notice_api", _base_api_dir / "receipt_notices/receipt_notices.py"
)
receipt_notice_api = importlib.util.module_from_spec(_receipt_notice_spec)
assert _receipt_notice_spec and _receipt_notice_spec.loader
_receipt_notice_spec.loader.exec_module(receipt_notice_api)

_shipment_notice_spec = importlib.util.spec_from_file_location(
    "config_gate_shipment_notice_api", _base_api_dir / "shipment_notices/shipment_notices.py"
)
shipment_notice_api = importlib.util.module_from_spec(_shipment_notice_spec)
assert _shipment_notice_spec and _shipment_notice_spec.loader
_shipment_notice_spec.loader.exec_module(shipment_notice_api)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_quality_execution_create_defect_should_map_business_error_with_trace_id(monkeypatch):
    async def _raise_business_error(*args, **kwargs):
        raise BusinessLogicError("inspection status invalid")

    monkeypatch.setattr(quality_exec_api.defect_record_service, "create_defect_from_incoming_inspection", _raise_business_error)

    with pytest.raises(HTTPException) as exc:
        await quality_exec_api.create_defect_from_incoming_inspection(
            inspection_id=1,
            defect_data=None,
            current_user=type("U", (), {"id": 1})(),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "inspection status invalid"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_receipt_notice_create_should_map_business_error_with_trace_id(monkeypatch):
    async def _raise_business_error(*args, **kwargs):
        raise BusinessLogicError("receipt notice blocked")

    monkeypatch.setattr(receipt_notice_api.receipt_notice_service, "create_receipt_notice", _raise_business_error)

    with pytest.raises(HTTPException) as exc:
        await receipt_notice_api.create_receipt_notice(
            notice_data=None,
            current_user=type("U", (), {"id": 1})(),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "receipt notice blocked"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_shipment_notice_get_should_map_not_found_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("shipment notice missing")

    monkeypatch.setattr(shipment_notice_api.shipment_notice_service, "get_shipment_notice_by_id", _raise_not_found)

    with pytest.raises(HTTPException) as exc:
        await shipment_notice_api.get_shipment_notice(
            notice_id=1,
            current_user=type("U", (), {"id": 1})(),
            tenant_id=1,
        )

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "shipment notice missing" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")
