"""批次质量态：销售可用量仅统计 qualified。"""

import asyncio
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from apps.kuaizhizao.utils.inventory_helper import (
    get_material_available_quantity,
    get_outbound_available_quantity,
)


def test_available_quantity_excludes_non_qualified_batches():
    info = {
        "available_quantity": 8.0,
        "on_hand": 8.0,
        "reserved_quantity": 0.0,
        "total_quantity": 8.0,
    }

    with patch(
        "apps.kuaizhizao.utils.inventory_helper.get_material_inventory_info",
        new=AsyncMock(return_value=info),
    ):
        qty = asyncio.run(get_material_available_quantity(tenant_id=1, material_id=10))

    assert qty == Decimal("8")


def test_outbound_query_filters_qualified_status():
    wh = MagicMock()
    wh.warehouse_type = "normal"

    batch = MagicMock()
    batch.warehouse_id = 2
    batch.quantity = Decimal("5")
    batch.batch_no = "B001"

    captured = {}

    class FakeQuery:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def filter(self, *_args, **_kwargs):
            return self

        async def all(self):
            return [batch]

    with patch(
        "apps.master_data.models.warehouse.Warehouse.get_or_none",
        new=AsyncMock(return_value=wh),
    ), patch(
        "apps.master_data.models.material.Material.get_or_none",
        new=AsyncMock(return_value=MagicMock()),
    ), patch(
        "apps.master_data.services.material_service.resolve_primary_default_warehouse_from_material",
        new=AsyncMock(return_value=(2, "成品仓")),
    ), patch(
        "apps.master_data.models.material_batch.MaterialBatch.filter",
        side_effect=lambda **kwargs: FakeQuery(**kwargs),
    ):
        available = asyncio.run(
            get_outbound_available_quantity(
                tenant_id=1,
                material_id=10,
                warehouse_id=2,
            )
        )

    assert captured.get("quality_status") == "qualified"
    assert available == Decimal("5")
