import pytest
import sys
import types

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError
from apps.kuaizhizao.services import quality_service
from apps.kuaizhizao.services.quality_service import (
    IncomingInspectionService,
    ProcessInspectionService,
    FinishedGoodsInspectionService,
)
from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.kuaizhizao.services.defect_record_service import DefectRecordService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_incoming_inspection_gate_blocks_when_disabled(monkeypatch):
    async def _disabled(_tenant_id: int):
        return False, True

    monkeypatch.setattr(quality_service, "_get_quality_policy_flags", _disabled)
    service = IncomingInspectionService()

    with pytest.raises(BusinessLogicError, match="未开启来料检验"):
        await service.create_incoming_inspection(tenant_id=1, inspection_data=None, created_by=1)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_process_inspection_gate_blocks_when_disabled(monkeypatch):
    async def _disabled(_tenant_id: int):
        return True, False

    monkeypatch.setattr(quality_service, "_get_quality_policy_flags", _disabled)
    service = ProcessInspectionService()

    with pytest.raises(BusinessLogicError, match="未开启过程检验"):
        await service.create_process_inspection(tenant_id=1, inspection_data=None, created_by=1)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finished_inspection_gate_blocks_when_disabled(monkeypatch):
    async def _disabled(_tenant_id: int):
        return False

    monkeypatch.setattr(quality_service, "_is_finished_inspection_enabled", _disabled)
    service = FinishedGoodsInspectionService()

    with pytest.raises(BusinessLogicError, match="未开启成品检验"):
        await service.create_finished_goods_inspection(tenant_id=1, inspection_data=None, created_by=1)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_defect_gate_blocks_when_disabled(monkeypatch):
    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"quality": {"defect_handling": False}}}

    monkeypatch.setattr(
        "apps.kuaizhizao.services.reporting_service.BusinessConfigService",
        lambda: _BizConfig(),
    )
    service = ReportingService()

    with pytest.raises(BusinessLogicError, match="未开启不良品处理"):
        await service.record_defect(
            tenant_id=1,
            reporting_record_id=1,
            defect_data=None,
            created_by=1,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_inspection_defect_gate_blocks_when_disabled(monkeypatch):
    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"quality": {"defect_handling": False}}}

    monkeypatch.setattr(
        "apps.kuaizhizao.services.defect_record_service.BusinessConfigService",
        lambda: _BizConfig(),
    )
    service = DefectRecordService()

    with pytest.raises(BusinessLogicError, match="未开启不良品处理"):
        await service.create_defect_from_incoming_inspection(
            tenant_id=1,
            inspection_id=1,
            defect_data=None,
            created_by=1,
        )
