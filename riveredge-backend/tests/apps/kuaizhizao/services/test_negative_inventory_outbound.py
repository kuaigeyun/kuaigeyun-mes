"""允许负库存出库：业务配置与扣减真源行为。"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.inventory_service import InventoryService
from infra.exceptions.exceptions import BusinessLogicError


@pytest.mark.asyncio
async def test_get_allow_negative_inventory_default_false():
    with patch(
        "apps.kuaizhizao.services.inventory_service.BusinessConfigService"
    ) as svc_cls:
        svc_cls.return_value.get_business_config = AsyncMock(
            return_value={"parameters": {"warehouse": {}}}
        )
        assert await InventoryService._get_allow_negative_inventory(1) is False


@pytest.mark.asyncio
async def test_get_allow_negative_inventory_true_when_configured():
    with patch(
        "apps.kuaizhizao.services.inventory_service.BusinessConfigService"
    ) as svc_cls:
        svc_cls.return_value.get_business_config = AsyncMock(
            return_value={
                "parameters": {"warehouse": {"allow_negative_inventory": True}}
            }
        )
        assert await InventoryService._get_allow_negative_inventory(1) is True


def test_sync_material_batch_status_keeps_in_stock_when_negative():
    batch = SimpleNamespace(quantity=Decimal("-3"), status="out_stock")
    InventoryService._sync_material_batch_status_after_qty_change(batch)
    assert batch.status == "in_stock"


def test_sync_material_batch_status_out_stock_when_zero():
    batch = SimpleNamespace(quantity=Decimal("0"), status="in_stock")
    InventoryService._sync_material_batch_status_after_qty_change(batch)
    assert batch.status == "out_stock"


@pytest.mark.asyncio
async def test_decrease_stock_skips_assert_when_allow_negative():
    wh = MagicMock()
    wh.warehouse_type = "normal"

    with patch(
        "apps.kuaizhizao.services.inventory_service.InventoryService._get_allow_negative_inventory",
        new=AsyncMock(return_value=True),
    ), patch(
        "apps.master_data.models.warehouse.Warehouse.get_or_none",
        new=AsyncMock(return_value=wh),
    ), patch(
        "apps.kuaizhizao.utils.inventory_helper.assert_outbound_warehouse_stock_available",
        new=AsyncMock(),
    ) as assert_mock, patch(
        "apps.kuaizhizao.services.inventory_service.InventoryService._get_warehouse_management_flags",
        new=AsyncMock(return_value=(False, False)),
    ), patch(
        "apps.kuaizhizao.services.inventory_service.BusinessConfigService"
    ) as cfg_cls, patch(
        "apps.master_data.models.material.Material.get_or_none",
        new=AsyncMock(return_value=MagicMock(batch_managed=False, name="M", code="M1")),
    ), patch(
        "apps.master_data.models.material_batch.MaterialBatch.filter"
    ) as batch_filter, patch(
        "apps.kuaizhizao.services.inventory_service.InventoryService._record_stock_movement",
        new=AsyncMock(),
    ), patch(
        "apps.kuaizhizao.services.inventory_service.InventoryService._mark_serials_out_stock",
        new=AsyncMock(),
    ), patch(
        "apps.kuaizhizao.services.work_order_readiness_service.notify_inventory_changed",
        return_value=None,
    ):
        cfg_cls.return_value.get_business_config = AsyncMock(
            return_value={"parameters": {"warehouse": {"lifo": False, "fifo_mode": "batch_id"}}}
        )
        empty_qs = MagicMock()
        empty_qs.filter.return_value = empty_qs
        empty_qs.select_for_update.return_value = empty_qs
        empty_qs.all = AsyncMock(return_value=[])
        batch_filter.return_value = empty_qs

        create_mock = AsyncMock()
        with patch(
            "apps.master_data.models.material_batch.MaterialBatch.create",
            create_mock,
        ), patch(
            "apps.kuaizhizao.services.inventory_service.InventoryService._find_in_stock_material_batch",
            new=AsyncMock(return_value=None),
        ), patch(
            "apps.kuaizhizao.services.inventory_service.InventoryService._resolve_warehouse_name",
            new=AsyncMock(return_value="主仓"),
        ):
            ok = await InventoryService._decrease_stock_no_atomic(
                tenant_id=1,
                material_id=10,
                quantity=Decimal("5"),
                warehouse_id=2,
                movement_type="sales_delivery",
                source_type="sales_delivery",
                source_doc_id=1,
                operator_id=1,
                operator_name="tester",
            )

    assert ok is True
    assert_mock.assert_not_called()
    create_mock.assert_awaited_once()
    create_kwargs = create_mock.await_args.kwargs
    assert create_kwargs["quantity"] == Decimal("-5")
    assert create_kwargs["batch_no"] == "DEFAULT"


@pytest.mark.asyncio
async def test_decrease_stock_blocks_when_allow_negative_disabled():
    wh = MagicMock()
    wh.warehouse_type = "normal"

    with patch(
        "apps.kuaizhizao.services.inventory_service.InventoryService._get_allow_negative_inventory",
        new=AsyncMock(return_value=False),
    ), patch(
        "apps.master_data.models.warehouse.Warehouse.get_or_none",
        new=AsyncMock(return_value=wh),
    ), patch(
        "apps.kuaizhizao.utils.inventory_helper.assert_outbound_warehouse_stock_available",
        new=AsyncMock(side_effect=BusinessLogicError("库存不足")),
    ):
        with pytest.raises(BusinessLogicError, match="库存不足"):
            await InventoryService._decrease_stock_no_atomic(
                tenant_id=1,
                material_id=10,
                quantity=Decimal("5"),
                warehouse_id=2,
                movement_type="sales_delivery",
            )
