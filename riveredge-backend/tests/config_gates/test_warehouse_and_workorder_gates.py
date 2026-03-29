import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from apps.kuaizhizao.services import warehouse_service
from apps.kuaizhizao.services import work_order_service
from apps.kuaizhizao.services.work_order_service import WorkOrderService


class _NoopTx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.unit
def test_location_required_should_block_when_missing():
    with pytest.raises(ValidationError, match="必须提供库位"):
        warehouse_service._validate_location_if_required(
            location_required=True,
            location_id=None,
            location_code=None,
            scene="销售出库",
            material_label="测试物料",
        )


@pytest.mark.unit
def test_location_not_required_should_pass():
    warehouse_service._validate_location_if_required(
        location_required=False,
        location_id=None,
        location_code=None,
        scene="销售出库",
        material_label="测试物料",
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batch_policy_blocks_when_batch_managed_missing_batch(monkeypatch):
    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"warehouse": {"batch_management": True, "serial_management": False}}}

    monkeypatch.setattr(warehouse_service, "BusinessConfigService", lambda: _BizConfig())

    material = types.SimpleNamespace(name="物料A", main_code="MAT-A", code="MAT-A", batch_managed=True, serial_managed=False)
    with pytest.raises(ValidationError, match="必须提供批号"):
        await warehouse_service._validate_batch_serial_policy(
            tenant_id=1,
            material=material,
            batch_number=None,
            serial_numbers=None,
            quantity=1,
            scene="采购入库",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_serial_policy_blocks_when_serial_managed_missing_serial(monkeypatch):
    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"warehouse": {"batch_management": False, "serial_management": True}}}

    monkeypatch.setattr(warehouse_service, "BusinessConfigService", lambda: _BizConfig())

    material = types.SimpleNamespace(name="物料B", main_code="MAT-B", code="MAT-B", batch_managed=False, serial_managed=True)
    with pytest.raises(ValidationError, match="必须提供序列号"):
        await warehouse_service._validate_batch_serial_policy(
            tenant_id=1,
            material=material,
            batch_number=None,
            serial_numbers=None,
            quantity=1,
            scene="销售出库",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_work_order_split_gate_blocks_when_disabled(monkeypatch):
    async def _disabled(self, _tenant_id: int, _key: str, default: bool = False):
        return False

    monkeypatch.setattr(WorkOrderService, "_is_work_order_param_enabled", _disabled)
    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    service = WorkOrderService()

    with pytest.raises(BusinessLogicError, match="未开启工单拆分"):
        await service.split_work_order(tenant_id=1, work_order_id=1, split_data=None, created_by=1)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_work_order_priority_gate_blocks_when_disabled(monkeypatch):
    async def _disabled(self, _tenant_id: int, _key: str, default: bool = False):
        return False

    monkeypatch.setattr(WorkOrderService, "_is_work_order_param_enabled", _disabled)
    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    service = WorkOrderService()

    with pytest.raises(BusinessLogicError, match="未开启工单优先级"):
        await service.set_work_order_priority(tenant_id=1, work_order_id=1, priority_data=None, updated_by=1)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_work_order_merge_gate_blocks_when_disabled(monkeypatch):
    async def _disabled(self, _tenant_id: int, _key: str, default: bool = False):
        return False

    monkeypatch.setattr(WorkOrderService, "_is_work_order_param_enabled", _disabled)
    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    service = WorkOrderService()

    with pytest.raises(BusinessLogicError, match="未开启工单合并"):
        await service.merge_work_orders(tenant_id=1, merge_data=None, created_by=1)


@pytest.mark.unit
def test_purchase_receipt_tolerance_blocks_when_exceeded():
    with pytest.raises(BusinessLogicError, match="采购入库超容差"):
        warehouse_service._validate_purchase_receipt_tolerance(
            ordered_quantity=Decimal("100"),
            already_received_quantity=Decimal("108"),
            incoming_quantity=Decimal("3"),
            tolerance_percentage=10,
            material_label="测试物料",
        )


@pytest.mark.unit
def test_purchase_receipt_tolerance_allows_on_threshold():
    warehouse_service._validate_purchase_receipt_tolerance(
        ordered_quantity=Decimal("100"),
        already_received_quantity=Decimal("105"),
        incoming_quantity=Decimal("5"),
        tolerance_percentage=10,
        material_label="测试物料",
    )


@pytest.mark.unit
def test_material_shortage_block_level_stage_mapping():
    assert work_order_service._material_shortage_block_applies(1, "release") is True
    assert work_order_service._material_shortage_block_applies(1, "operation_start") is False
    assert work_order_service._material_shortage_block_applies(2, "operation_start") is True
    assert work_order_service._material_shortage_block_applies(2, "reporting") is False
    assert work_order_service._material_shortage_block_applies(3, "reporting") is True
