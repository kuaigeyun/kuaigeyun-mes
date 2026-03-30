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


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_price_fluctuation_limit_clamped(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"purchase": {"price_fluctuation_limit_percent": 120}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    pct = await BusinessConfigService().get_purchase_price_fluctuation_limit_percent(tenant_id=1)
    assert pct == 100.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_purchase_price_fluctuation_limit_invalid_defaults_zero(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"purchase": {"price_fluctuation_limit_percent": "oops"}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    pct = await BusinessConfigService().get_purchase_price_fluctuation_limit_percent(tenant_id=1)
    assert pct == 0.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finance_auto_write_off_precision_limit_clamped(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"finance": {"auto_write_off_precision_limit": 999}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    limit = await BusinessConfigService().get_finance_auto_write_off_precision_limit(tenant_id=1)
    assert limit == 100.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finance_auto_write_off_precision_limit_invalid_defaults_to_zero(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"finance": {"auto_write_off_precision_limit": "oops"}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    limit = await BusinessConfigService().get_finance_auto_write_off_precision_limit(tenant_id=1)
    assert limit == 0.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finance_auto_generate_receivable_from_sales_invoice_defaults_false(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"finance": {}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    enabled = await BusinessConfigService().get_finance_auto_generate_receivable_from_sales_invoice(tenant_id=1)
    assert enabled is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finance_auto_generate_payable_from_purchase_invoice_reads_true(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"finance": {"auto_generate_payable_from_purchase_invoice": True}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    enabled = await BusinessConfigService().get_finance_auto_generate_payable_from_purchase_invoice(tenant_id=1)
    assert enabled is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_price_deviation_threshold_clamped(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"sales": {"price_deviation_approval_threshold_percent": 120}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    pct = await BusinessConfigService().get_sales_price_deviation_approval_threshold_percent(tenant_id=1)
    assert pct == 100.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_price_deviation_threshold_invalid_defaults_zero(monkeypatch):
    async def _fake_get_business_config(self, _tenant_id: int):
        return {"parameters": {"sales": {"price_deviation_approval_threshold_percent": "bad"}}}

    monkeypatch.setattr(BusinessConfigService, "get_business_config", _fake_get_business_config)
    pct = await BusinessConfigService().get_sales_price_deviation_approval_threshold_percent(tenant_id=1)
    assert pct == 0.0
