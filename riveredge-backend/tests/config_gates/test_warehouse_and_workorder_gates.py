import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from apps.kuaizhizao.services import warehouse_service
from apps.kuaizhizao.services import work_order_service
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.warehouse_service import PurchaseReceiptService
from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService


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
@pytest.mark.asyncio
async def test_release_work_order_should_skip_shortage_when_block_level_zero(monkeypatch):
    service = WorkOrderService()
    called = {"shortage_checked": False}

    work_order = types.SimpleNamespace(id=1, code="WO-001", status="draft")

    async def _get_by_id(*_args, **_kwargs):
        return work_order

    async def _check_shortage(**_kwargs):
        called["shortage_checked"] = True
        return {"has_shortage": True, "shortage_items": [], "total_shortage_count": 0}

    async def _update_with_user(**_kwargs):
        return types.SimpleNamespace(id=1, code="WO-001", status="released")

    async def _get_user_info(*_args, **_kwargs):
        return {"name": "tester"}

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 0

    class _Timing:
        async def record_node_end(self, **_kwargs):
            return None

        async def record_node_start(self, **_kwargs):
            return None

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(work_order_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(work_order_service, "DocumentTimingService", lambda: _Timing())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(service, "check_material_shortage", _check_shortage)
    monkeypatch.setattr(service, "update_with_user", _update_with_user)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(work_order_service.WorkOrderResponse, "model_validate", lambda x: x)

    result = await service.release_work_order(
        tenant_id=1,
        work_order_id=1,
        released_by=7,
        check_shortage=True,
    )
    assert getattr(result, "status", "") == "released"
    assert called["shortage_checked"] is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_release_work_order_should_block_shortage_when_block_level_one(monkeypatch):
    service = WorkOrderService()
    work_order = types.SimpleNamespace(id=2, code="WO-002", status="draft")

    async def _get_by_id(*_args, **_kwargs):
        return work_order

    async def _check_shortage(**_kwargs):
        return {
            "has_shortage": True,
            "shortage_items": [{"material_name": "物料A", "shortage_quantity": Decimal("3"), "unit": "个"}],
            "total_shortage_count": 1,
        }

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 1

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(work_order_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(service, "check_material_shortage", _check_shortage)

    with pytest.raises(BusinessLogicError, match="工单存在缺料，无法下达"):
        await service.release_work_order(
            tenant_id=1,
            work_order_id=2,
            released_by=8,
            check_shortage=True,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_work_order_operation_blocks_when_picking_not_confirmed(monkeypatch):
    service = WorkOrderService()
    work_order = types.SimpleNamespace(status="released")

    async def _get_by_id(*_args, **_kwargs):
        return work_order

    async def _has_confirmed(*_args, **_kwargs):
        return False

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(service, "has_confirmed_picking_for_work_order", _has_confirmed)

    class _BizConfig:
        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_operation_start": True}

        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 0

    monkeypatch.setattr(work_order_service, "BusinessConfigService", lambda: _BizConfig())

    with pytest.raises(BusinessLogicError, match="未确认领料，禁止开工"):
        await service.start_work_order_operation(
            tenant_id=1,
            work_order_id=1001,
            operation_id=2001,
            started_by=7,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_work_order_operation_blocks_when_material_shortage(monkeypatch):
    service = WorkOrderService()
    work_order = types.SimpleNamespace(status="released")

    async def _get_by_id(*_args, **_kwargs):
        return work_order

    async def _has_confirmed(*_args, **_kwargs):
        return True

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(service, "has_confirmed_picking_for_work_order", _has_confirmed)

    class _BizConfig:
        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_operation_start": False}

        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 2

    async def _check_shortage(**_kwargs):
        return {
            "has_shortage": True,
            "shortage_items": [
                {"material_name": "物料A", "shortage_quantity": Decimal("5"), "unit": "个"},
                {"material_name": "物料B", "shortage_quantity": Decimal("2"), "unit": "个"},
                {"material_name": "物料C", "shortage_quantity": Decimal("1"), "unit": "个"},
                {"material_name": "物料D", "shortage_quantity": Decimal("9"), "unit": "个"},
            ],
            "total_shortage_count": 4,
        }

    monkeypatch.setattr(work_order_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(service, "check_material_shortage", _check_shortage)

    with pytest.raises(BusinessLogicError, match="工单存在缺料，无法开工"):
        await service.start_work_order_operation(
            tenant_id=1,
            work_order_id=1002,
            operation_id=2002,
            started_by=8,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_work_order_operation_blocks_when_work_order_frozen(monkeypatch):
    service = WorkOrderService()
    work_order = types.SimpleNamespace(status="released", is_frozen=True, freeze_reason="物料异常")

    async def _get_by_id(*_args, **_kwargs):
        return work_order

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)

    with pytest.raises(BusinessLogicError, match="工单已冻结，不能开工"):
        await service.start_work_order_operation(
            tenant_id=1,
            work_order_id=1003,
            operation_id=2003,
            started_by=9,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_manually_complete_work_order_should_block_when_draft(monkeypatch):
    service = WorkOrderService()

    async def _get_by_id(*_args, **_kwargs):
        return types.SimpleNamespace(status="draft")

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)

    with pytest.raises(ValidationError, match="只能对已下达或进行中的工单指定结束"):
        await service.manually_complete_work_order(
            tenant_id=1,
            work_order_id=3001,
            completed_by=7,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_manually_complete_work_order_should_block_when_status_not_allowed(monkeypatch):
    service = WorkOrderService()

    async def _get_by_id(*_args, **_kwargs):
        return types.SimpleNamespace(status="paused")

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)

    with pytest.raises(ValidationError, match="只能对已下达或进行中的工单指定结束"):
        await service.manually_complete_work_order(
            tenant_id=1,
            work_order_id=3005,
            completed_by=7,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_manually_complete_work_order_should_end_previous_in_progress_node(monkeypatch):
    service = WorkOrderService()
    captured = {}

    async def _get_by_id(*_args, **_kwargs):
        return types.SimpleNamespace(id=1, code="WO-1001", status="in_progress")

    async def _update_with_user(**_kwargs):
        return types.SimpleNamespace(id=1, code="WO-1001", status="completed", manually_completed=True)

    async def _get_user_info(*_args, **_kwargs):
        return {"name": "tester"}

    class _Timing:
        async def record_node_end(self, **kwargs):
            captured["end_node_code"] = kwargs.get("node_code")
            return None

        async def record_node_start(self, **kwargs):
            captured["start_node_code"] = kwargs.get("node_code")
            return None

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(work_order_service, "DocumentTimingService", lambda: _Timing())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(service, "update_with_user", _update_with_user)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(work_order_service.WorkOrderResponse, "model_validate", lambda x: x)

    result = await service.manually_complete_work_order(
        tenant_id=1,
        work_order_id=3002,
        completed_by=8,
    )
    assert getattr(result, "status", "") == "completed"
    assert captured["end_node_code"] == "in_progress"
    assert captured["start_node_code"] == "completed"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_work_order_should_block_when_has_execution_trace_without_reporting(monkeypatch):
    service = WorkOrderService()

    async def _get_by_id(*_args, **_kwargs):
        return types.SimpleNamespace(
            status="released",
            manually_completed=False,
            actual_start_date=object(),
            completed_quantity=Decimal("0"),
        )

    class _EmptyReportingQuery:
        async def all(self):
            return []

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(work_order_service.ReportingRecord, "filter", lambda **_kwargs: _EmptyReportingQuery())

    with pytest.raises(BusinessLogicError, match="已有执行痕迹"):
        await service.revoke_work_order(
            tenant_id=1,
            work_order_id=4001,
            revoked_by=9,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_work_order_should_pass_when_released_and_no_trace(monkeypatch):
    service = WorkOrderService()
    captured = {}

    async def _get_by_id(*_args, **_kwargs):
        return types.SimpleNamespace(
            id=1,
            code="WO-2001",
            status="released",
            manually_completed=False,
            actual_start_date=None,
            completed_quantity=Decimal("0"),
        )

    class _EmptyReportingQuery:
        async def all(self):
            return []

    async def _update_with_user(**_kwargs):
        return types.SimpleNamespace(id=1, code="WO-2001", status="draft", manually_completed=False)

    class _Timing:
        async def record_node_end(self, **kwargs):
            captured["end_node_code"] = kwargs.get("node_code")
            return None

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(service, "update_with_user", _update_with_user)
    monkeypatch.setattr(work_order_service.ReportingRecord, "filter", lambda **_kwargs: _EmptyReportingQuery())
    monkeypatch.setattr(work_order_service, "DocumentTimingService", lambda: _Timing())
    monkeypatch.setattr(work_order_service.WorkOrderResponse, "model_validate", lambda x: x)

    result = await service.revoke_work_order(
        tenant_id=1,
        work_order_id=4002,
        revoked_by=10,
    )
    assert getattr(result, "status", "") == "draft"
    assert captured.get("end_node_code") == "released"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_work_order_should_end_completed_node_when_from_manual_completed(monkeypatch):
    service = WorkOrderService()
    captured = {}

    async def _get_by_id(*_args, **_kwargs):
        return types.SimpleNamespace(
            id=1,
            code="WO-2002",
            status="completed",
            manually_completed=True,
            actual_start_date=None,
            completed_quantity=Decimal("0"),
        )

    class _EmptyReportingQuery:
        async def all(self):
            return []

    async def _update_with_user(**_kwargs):
        return types.SimpleNamespace(id=1, code="WO-2002", status="draft", manually_completed=False)

    class _Timing:
        async def record_node_end(self, **kwargs):
            captured["end_node_code"] = kwargs.get("node_code")
            return None

    monkeypatch.setattr(work_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(service, "get_by_id", _get_by_id)
    monkeypatch.setattr(service, "update_with_user", _update_with_user)
    monkeypatch.setattr(work_order_service.ReportingRecord, "filter", lambda **_kwargs: _EmptyReportingQuery())
    monkeypatch.setattr(work_order_service, "DocumentTimingService", lambda: _Timing())
    monkeypatch.setattr(work_order_service.WorkOrderResponse, "model_validate", lambda x: x)

    result = await service.revoke_work_order(
        tenant_id=1,
        work_order_id=4003,
        revoked_by=11,
    )
    assert getattr(result, "status", "") == "draft"
    assert captured.get("end_node_code") == "completed"


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


@pytest.mark.unit
def test_unit_conversion_factor_should_resolve_from_material_units():
    units = {
        "units": [
            {"unit": "箱", "numerator": 12, "denominator": 1},
            {"unit": "托", "numerator": 120, "denominator": 1},
        ]
    }
    factor = warehouse_service._resolve_unit_conversion_factor(units, "箱")
    assert factor == Decimal("12")


@pytest.mark.unit
def test_to_base_quantity_should_convert_non_base_unit():
    material = types.SimpleNamespace(base_unit="个", units={"units": [{"unit": "箱", "numerator": 12, "denominator": 1}]})
    qty = warehouse_service._to_base_quantity(
        quantity=Decimal("2"),
        material_unit="箱",
        material=material,
    )
    assert qty == Decimal("24")


@pytest.mark.unit
def test_sales_return_batch_traceability_blocks_missing_return_batch():
    with pytest.raises(ValidationError, match="必须录入原出库批次号"):
        warehouse_service._validate_sales_return_batch_traceability(
            source_batch_number="BATCH-001",
            return_batch_number=None,
            material_label="测试物料",
        )


@pytest.mark.unit
def test_sales_return_batch_traceability_blocks_mismatch_batch():
    with pytest.raises(ValidationError, match="不一致"):
        warehouse_service._validate_sales_return_batch_traceability(
            source_batch_number="BATCH-001",
            return_batch_number="BATCH-999",
            material_label="测试物料",
        )


@pytest.mark.unit
def test_sales_return_batch_traceability_pass_when_source_has_no_batch():
    warehouse_service._validate_sales_return_batch_traceability(
        source_batch_number=None,
        return_batch_number=None,
        material_label="测试物料",
    )


@pytest.mark.unit
def test_purchase_receipt_quality_fields_should_force_pending_when_inspection_required():
    qualified, unqualified, status = warehouse_service._resolve_purchase_item_quality_fields(
        receipt_quantity=Decimal("10"),
        qualified_quantity=Decimal("10"),
        unqualified_quantity=Decimal("0"),
        quality_status="合格",
        require_incoming_inspection=True,
    )
    assert qualified == Decimal("0")
    assert unqualified == Decimal("0")
    assert status == "待检"


@pytest.mark.unit
def test_purchase_receipt_quality_fields_should_keep_manual_values_when_inspection_not_required():
    qualified, unqualified, status = warehouse_service._resolve_purchase_item_quality_fields(
        receipt_quantity=Decimal("10"),
        qualified_quantity=Decimal("8"),
        unqualified_quantity=Decimal("2"),
        quality_status="不合格",
        require_incoming_inspection=False,
    )
    assert qualified == Decimal("8")
    assert unqualified == Decimal("2")
    assert status == "不合格"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_purchase_receipt_should_apply_tolerance_gate(monkeypatch):
    service = PurchaseReceiptService()

    class _DummyItem:
        material_code = "MAT-001"
        material_name = "物料A"
        receipt_quantity = Decimal("10")
        unit_price = Decimal("2")
        purchase_order_item_id = 99
        qualified_quantity = None
        unqualified_quantity = None

        def model_dump(self, **_kwargs):
            return {
                "material_id": 1,
                "material_code": self.material_code,
                "material_name": self.material_name,
                "purchase_order_item_id": self.purchase_order_item_id,
            }

    class _DummyUpdate:
        items = [_DummyItem()]

        @staticmethod
        def model_dump(**_kwargs):
            return {}

    receipt = types.SimpleNamespace(id=1, status="草稿")
    po_item = types.SimpleNamespace(id=99, ordered_quantity=Decimal("100"))
    historical_item = types.SimpleNamespace(receipt_id=200, receipt_quantity=Decimal("95"))
    historical_receipt = types.SimpleNamespace(id=200, status="已入库")

    class _ReceiptFilter:
        async def update(self, **_kwargs):
            return None

    class _PurchaseReceiptItemFilter:
        def __init__(self, kwargs):
            self.kwargs = kwargs

        async def delete(self):
            return None

        async def all(self):
            if "purchase_order_item_id" in self.kwargs:
                return [historical_item]
            return []

    class _POItemQuery:
        def select_for_update(self):
            return self

        async def first(self):
            return po_item

    monkeypatch.setattr(warehouse_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(warehouse_service.PurchaseReceipt, "get_or_none", lambda **_kwargs: receipt)
    monkeypatch.setattr(warehouse_service.PurchaseReceipt, "filter", lambda **_kwargs: _ReceiptFilter())
    monkeypatch.setattr(warehouse_service.PurchaseReceiptItem, "filter", lambda **kwargs: _PurchaseReceiptItemFilter(kwargs))
    monkeypatch.setattr(warehouse_service.PurchaseReceipt, "get", lambda **_kwargs: receipt)
    monkeypatch.setattr(
        "apps.kuaizhizao.models.purchase_order.PurchaseOrderItem.filter",
        lambda **_kwargs: _POItemQuery(),
    )
    async def _get_tolerance(_tenant_id: int):
        return 10.0

    async def _get_business_config(_tenant_id: int):
        return {"parameters": {"quality": {"require_incoming_inspection_for_receipt": False}}}

    monkeypatch.setattr(
        service.business_config_service,
        "get_purchase_tolerance_percentage",
        _get_tolerance,
    )
    monkeypatch.setattr(
        service.business_config_service,
        "get_business_config",
        _get_business_config,
    )

    async def _fake_receipt_get_or_none(**kwargs):
        rid = kwargs.get("id")
        if rid == 200:
            return historical_receipt
        return receipt

    monkeypatch.setattr(warehouse_service.PurchaseReceipt, "get_or_none", _fake_receipt_get_or_none)

    def _always_block(**_kwargs):
        raise BusinessLogicError("采购入库超容差")

    monkeypatch.setattr(warehouse_service, "_validate_purchase_receipt_tolerance", _always_block)

    with pytest.raises(BusinessLogicError, match="采购入库超容差"):
        await service.update_purchase_receipt(
            tenant_id=1,
            receipt_id=1,
            receipt_data=_DummyUpdate(),
            updated_by=7,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_purchase_receipt_should_auto_fill_batch_number(monkeypatch):
    service = PurchaseReceiptService()
    captured = {}

    class _DummyItem:
        material_id = 101
        material_code = "MAT-101"
        material_name = "批次物料"
        receipt_quantity = Decimal("6")
        unit_price = Decimal("3")
        purchase_order_item_id = None
        qualified_quantity = None
        unqualified_quantity = None
        batch_number = None

        def model_dump(self, **_kwargs):
            return {
                "material_id": self.material_id,
                "material_code": self.material_code,
                "material_name": self.material_name,
            }

    class _DummyUpdate:
        items = [_DummyItem()]
        supplier_id = None

        @staticmethod
        def model_dump(**_kwargs):
            return {}

    receipt = types.SimpleNamespace(id=1, status="草稿", supplier_id=None)
    material = types.SimpleNamespace(id=101, uuid="mat-uuid", batch_managed=True)

    class _ReceiptFilter:
        async def update(self, **_kwargs):
            return None

    class _PurchaseReceiptItemFilter:
        async def delete(self):
            return None

    async def _fake_create_item(**kwargs):
        captured["batch_number"] = kwargs.get("batch_number")
        captured["quality_status"] = kwargs.get("quality_status")
        captured["qualified_quantity"] = kwargs.get("qualified_quantity")
        captured["unqualified_quantity"] = kwargs.get("unqualified_quantity")
        return types.SimpleNamespace(id=1, **kwargs)

    async def _get_tolerance(_tenant_id: int):
        return 10.0

    async def _get_business_config(_tenant_id: int):
        return {"parameters": {"quality": {"require_incoming_inspection_for_receipt": True}}}

    async def _fake_get_receipt(**_kwargs):
        return receipt

    async def _fake_get_material(**_kwargs):
        return material

    async def _fake_ensure_batch_no_for_item(**_kwargs):
        return "AUTO-BATCH-001"

    monkeypatch.setattr(warehouse_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(warehouse_service.PurchaseReceipt, "get_or_none", _fake_get_receipt)
    monkeypatch.setattr(warehouse_service.PurchaseReceipt, "get", _fake_get_receipt)
    monkeypatch.setattr(warehouse_service.PurchaseReceipt, "filter", lambda **_kwargs: _ReceiptFilter())
    monkeypatch.setattr(warehouse_service.PurchaseReceiptItem, "filter", lambda **_kwargs: _PurchaseReceiptItemFilter())
    monkeypatch.setattr(warehouse_service.PurchaseReceiptItem, "create", _fake_create_item)
    monkeypatch.setattr(warehouse_service.PurchaseReceiptResponse, "model_validate", lambda x: x)
    monkeypatch.setattr(
        service.business_config_service,
        "get_purchase_tolerance_percentage",
        _get_tolerance,
    )
    monkeypatch.setattr(
        service.business_config_service,
        "get_business_config",
        _get_business_config,
    )
    monkeypatch.setattr("apps.master_data.models.material.Material.get_or_none", _fake_get_material)
    monkeypatch.setattr(
        "apps.kuaizhizao.services.batch_serial_helper.ensure_batch_no_for_item",
        _fake_ensure_batch_no_for_item,
    )

    await service.update_purchase_receipt(
        tenant_id=1,
        receipt_id=1,
        receipt_data=_DummyUpdate(),
        updated_by=7,
    )
    assert captured["batch_number"] == "AUTO-BATCH-001"
    assert captured["quality_status"] == "待检"
    assert captured["qualified_quantity"] == Decimal("0")
    assert captured["unqualified_quantity"] == Decimal("0")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_consume_shipment_notice_reservation_after_delivery_should_bind_consumable_notice(monkeypatch):
    service = SalesDeliveryService()
    captured = {}

    delivery = types.SimpleNamespace(id=5001, delivery_code="SD-5001", sales_order_id=200, warehouse_id=1)
    delivery_items = [
        types.SimpleNamespace(material_id=101, delivery_quantity=Decimal("5")),
        types.SimpleNamespace(material_id=102, delivery_quantity=Decimal("3")),
    ]
    notice_a = types.SimpleNamespace(id=9001)
    notice_b = types.SimpleNamespace(id=9002)

    class _NoticeQuery:
        def __init__(self, kwargs):
            self.kwargs = kwargs

        def filter(self, **_kwargs):
            return self

        def order_by(self, *_args, **_kwargs):
            return self

        async def all(self):
            if "sales_order_id" in self.kwargs:
                return [notice_a, notice_b]
            return []

        async def update(self, **kwargs):
            captured["update_kwargs"] = kwargs
            captured["updated_ids"] = self.kwargs.get("id__in", [])
            return 1

    class _ItemsQuery:
        def __init__(self, rows):
            self.rows = rows

        async def all(self):
            return self.rows

    def _notice_filter(**kwargs):
        return _NoticeQuery(kwargs)

    def _notice_item_filter(**kwargs):
        if kwargs.get("notice_id") == 9001:
            return _ItemsQuery(
                [
                    types.SimpleNamespace(material_id=101, notice_quantity=Decimal("5")),
                    types.SimpleNamespace(material_id=102, notice_quantity=Decimal("3")),
                ]
            )
        if kwargs.get("notice_id") == 9002:
            return _ItemsQuery([types.SimpleNamespace(material_id=101, notice_quantity=Decimal("1"))])
        return _ItemsQuery([])

    monkeypatch.setattr(warehouse_service.ShipmentNotice, "filter", _notice_filter)
    monkeypatch.setattr(warehouse_service.ShipmentNoticeItem, "filter", _notice_item_filter)

    await service._consume_shipment_notice_reservation_after_delivery(
        tenant_id=1,
        delivery=delivery,
        delivery_items=delivery_items,
        updated_by=7,
    )

    assert captured["updated_ids"] == [9001]
    assert captured["update_kwargs"]["status"] == "已出库"
    assert captured["update_kwargs"]["sales_delivery_id"] == 5001
    assert captured["update_kwargs"]["sales_delivery_code"] == "SD-5001"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_consume_shipment_notice_reservation_after_delivery_should_skip_when_not_fully_match(monkeypatch):
    service = SalesDeliveryService()
    captured = {"updated_ids": []}

    delivery = types.SimpleNamespace(id=5002, delivery_code="SD-5002", sales_order_id=201, warehouse_id=1)
    delivery_items = [types.SimpleNamespace(material_id=101, delivery_quantity=Decimal("2"))]
    notice = types.SimpleNamespace(id=9010)

    class _NoticeQuery:
        def __init__(self, kwargs):
            self.kwargs = kwargs

        def filter(self, **_kwargs):
            return self

        def order_by(self, *_args, **_kwargs):
            return self

        async def all(self):
            if "sales_order_id" in self.kwargs:
                return [notice]
            return []

        async def update(self, **kwargs):
            captured["updated_ids"] = self.kwargs.get("id__in", [])
            captured["update_kwargs"] = kwargs
            return 1

    class _ItemsQuery:
        async def all(self):
            return [types.SimpleNamespace(material_id=101, notice_quantity=Decimal("3"))]

    monkeypatch.setattr(warehouse_service.ShipmentNotice, "filter", lambda **kwargs: _NoticeQuery(kwargs))
    monkeypatch.setattr(warehouse_service.ShipmentNoticeItem, "filter", lambda **_kwargs: _ItemsQuery())

    await service._consume_shipment_notice_reservation_after_delivery(
        tenant_id=1,
        delivery=delivery,
        delivery_items=delivery_items,
        updated_by=9,
    )

    assert captured["updated_ids"] == []
