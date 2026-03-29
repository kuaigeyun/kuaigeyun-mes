import sys
import types
import importlib.util
from pathlib import Path

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError
from apps.kuaizhizao.services import reporting_service
from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.kuaizhizao.services import demand_computation_service
from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from infra.services import business_config_service as infra_business_config_service

_reporting_api_path = Path(__file__).resolve().parents[2] / "src/apps/kuaizhizao/api/productions/reporting.py"
_reporting_api_spec = importlib.util.spec_from_file_location("config_gate_reporting_api", _reporting_api_path)
reporting_api = importlib.util.module_from_spec(_reporting_api_spec)
assert _reporting_api_spec and _reporting_api_spec.loader
_reporting_api_spec.loader.exec_module(reporting_api)


class _NoopTx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_data_correction_gate_blocks_when_disabled(monkeypatch):
    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": False}}}

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    service = ReportingService()

    with pytest.raises(BusinessLogicError, match="未开启报工数据修正"):
        await service.correct_reporting_data(
            tenant_id=1,
            record_id=1,
            correct_data=None,
            corrected_by=1,
            correction_reason="need fix",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_demand_generate_work_order_gate_blocks_when_auto_generate_disabled(monkeypatch):
    class _Computation:
        computation_status = "完成"

    class _DemandComputation:
        @staticmethod
        async def get_or_none(**kwargs):
            return _Computation()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"work_order": {"auto_generate": False}}}

    monkeypatch.setattr(demand_computation_service, "DemandComputation", _DemandComputation)
    monkeypatch.setattr(infra_business_config_service, "BusinessConfigService", lambda: _BizConfig())

    service = DemandComputationService()
    with pytest.raises(BusinessLogicError, match="未开启自动生成工单"):
        await service.generate_work_orders_and_purchase_orders(
            tenant_id=1,
            computation_id=1,
            created_by=1,
            generate_mode="work_order_only",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_manual_entry_mode(monkeypatch):
    class _FakeService:
        async def create_reporting_record(self, **kwargs):
            assert kwargs["entry_mode"] == "manual"
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.create_reporting_record(
        reporting=None,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_quick_entry_mode(monkeypatch):
    class _FakeService:
        async def create_reporting_record(self, **kwargs):
            assert kwargs["entry_mode"] == "quick"
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.create_quick_reporting_record(
        reporting=None,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}
