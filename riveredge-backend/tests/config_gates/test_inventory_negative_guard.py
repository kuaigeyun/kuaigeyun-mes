import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaizhizao.services.inventory_service import InventoryService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_decrease_stock_should_block_non_positive_quantity():
    with pytest.raises(ValueError, match="扣减数量必须大于0"):
        await InventoryService.decrease_stock.__wrapped__(  # type: ignore[attr-defined]
            tenant_id=1,
            material_id=1001,
            quantity=Decimal("0"),
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_decrease_stock_should_block_negative_line_side_after_deduction(monkeypatch):
    from apps.kuaizhizao.services import inventory_service

    class _Warehouse:
        warehouse_type = "line_side"

    class _LineSideInv:
        quantity = Decimal("1")
        reserved_quantity = Decimal("-10")

        async def save(self):
            return None

    class _LineSideQuery:
        def select_for_update(self):
            return self

        async def first(self):
            return _LineSideInv()

    async def _get_wh(**_kwargs):
        return _Warehouse()

    monkeypatch.setattr("apps.master_data.models.warehouse.Warehouse.get_or_none", _get_wh)
    monkeypatch.setattr(
        inventory_service,
        "LineSideInventory",
        types.SimpleNamespace(filter=lambda **_kwargs: _LineSideQuery()),
        raising=False,
    )
    monkeypatch.setattr(
        "apps.kuaizhizao.models.line_side_inventory.LineSideInventory.filter",
        lambda **_kwargs: _LineSideQuery(),
    )

    with pytest.raises(ValueError, match="并发扣减导致线边仓负库存"):
        await InventoryService.decrease_stock.__wrapped__(  # type: ignore[attr-defined]
            tenant_id=1,
            material_id=1001,
            quantity=Decimal("5"),
            warehouse_id=1,
        )
