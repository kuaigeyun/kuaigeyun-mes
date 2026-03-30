import sys
import types
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.master_data.api import (
    batch_serial_rules,
    factory,
    material,
    process,
    product,
    supply_chain,
    validation,
    warehouse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


@pytest.mark.unit
@pytest.mark.asyncio
async def test_factory_api_create_plant_should_map_validation_error_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad plant payload")

    monkeypatch.setattr(factory.FactoryService, "create_plant", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await factory.create_plant(
            data=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad plant payload"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_warehouse_api_get_should_map_not_found_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("warehouse missing")

    monkeypatch.setattr(warehouse.WarehouseService, "get_warehouse_by_uuid", _raise_not_found)

    with pytest.raises(HTTPException) as exc:
        await warehouse.get_warehouse(
            warehouse_uuid="u-1",
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "warehouse missing" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_material_api_create_group_should_map_validation_error_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad material group payload")

    monkeypatch.setattr(material.MaterialService, "create_material_group", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await material.create_material_group(
            data=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad material group payload"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_process_api_create_defect_type_should_map_validation_error_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad defect type payload")

    monkeypatch.setattr(process.ProcessService, "create_defect_type", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await process.create_defect_type(
            data=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad defect type payload"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_supply_chain_api_create_customer_should_map_validation_error_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("bad customer payload")

    monkeypatch.setattr(supply_chain.SupplyChainService, "create_customer", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await supply_chain.create_customer(
            data=None,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "bad customer payload"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_product_api_get_should_map_not_found_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("product missing")

    monkeypatch.setattr(product.ProductService, "get_product_by_uuid", _raise_not_found)

    with pytest.raises(HTTPException) as exc:
        await product.get_product(
            product_uuid="p-1",
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "product missing" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validation_api_should_map_runtime_error_with_trace_id(monkeypatch):
    async def _raise_runtime_error(*args, **kwargs):
        raise RuntimeError("validation failed")

    monkeypatch.setattr(validation.DataValidationService, "validate_product_for_work_order", _raise_runtime_error)

    with pytest.raises(HTTPException) as exc:
        await validation.validate_product_for_work_order(
            product_id=1,
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 500
    assert isinstance(exc.value.detail, dict)
    assert "validation failed" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batch_serial_rules_api_get_batch_rule_should_map_not_found_with_trace_id(monkeypatch):
    async def _return_none(*args, **kwargs):
        return None

    monkeypatch.setattr(batch_serial_rules.BatchRuleService, "get_rule_by_uuid", _return_none)

    with pytest.raises(HTTPException) as exc:
        await batch_serial_rules.get_batch_rule(
            rule_uuid="r-1",
            current_user=SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "批号规则不存在" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")
