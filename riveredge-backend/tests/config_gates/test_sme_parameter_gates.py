import sys
import types

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.services.business_config_service import BusinessConfigService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_material_shortage_block_level_fallback_to_legacy_allow_true(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"work_order": {"allow_production_without_material": True}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    level = await BusinessConfigService().get_material_shortage_block_level(tenant_id=1)
    assert level == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_material_shortage_block_level_fallback_to_legacy_allow_false(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"work_order": {"allow_production_without_material": False}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    level = await BusinessConfigService().get_material_shortage_block_level(tenant_id=1)
    assert level == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_material_shortage_block_level_clamped_into_range(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"work_order": {"material_shortage_block_level": 9}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    level = await BusinessConfigService().get_material_shortage_block_level(tenant_id=1)
    assert level == 3


@pytest.mark.unit
@pytest.mark.asyncio
async def test_material_shortage_block_level_invalid_value_defaults_to_one(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"work_order": {"material_shortage_block_level": "bad"}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    level = await BusinessConfigService().get_material_shortage_block_level(tenant_id=1)
    assert level == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_tolerance_percentage_clamped(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"purchase": {"tolerance_percentage": 120}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    pct = await BusinessConfigService().get_purchase_tolerance_percentage(tenant_id=1)
    assert pct == 100.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_tolerance_percentage_invalid_defaults_to_zero(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"purchase": {"tolerance_percentage": "oops"}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    pct = await BusinessConfigService().get_purchase_tolerance_percentage(tenant_id=1)
    assert pct == 0.0
