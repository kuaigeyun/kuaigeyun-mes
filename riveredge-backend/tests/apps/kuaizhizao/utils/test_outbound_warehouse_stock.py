"""出库仓库可用量校验（主仓默认仓库归属）。"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.utils.inventory_helper import (
    assert_outbound_warehouse_stock_available,
    get_outbound_available_quantity,
)
from infra.exceptions.exceptions import BusinessLogicError


@pytest.mark.asyncio
async def test_main_warehouse_available_zero_when_default_mismatch():
    wh = MagicMock()
    wh.warehouse_type = "normal"

    with patch(
        "apps.master_data.models.warehouse.Warehouse.get_or_none",
        new=AsyncMock(return_value=wh),
    ), patch(
        "apps.master_data.models.material.Material.get_or_none",
        new=AsyncMock(return_value=MagicMock(name="原料A", main_code="RM001", code="RM001")),
    ), patch(
        "apps.master_data.services.material_service.resolve_primary_default_warehouse_from_material",
        new=AsyncMock(return_value=(1, "A仓")),
    ):
        available = await get_outbound_available_quantity(
            tenant_id=1,
            material_id=10,
            warehouse_id=2,
        )

    assert available == Decimal("0")


@pytest.mark.asyncio
async def test_assert_outbound_rejects_cross_warehouse_pick():
    wh_selected = MagicMock()
    wh_selected.warehouse_type = "normal"
    wh_selected.name = "B仓"

    material = MagicMock()
    material.name = "原料A"
    material.main_code = "RM001"
    material.code = "RM001"

    with patch(
        "apps.kuaizhizao.utils.inventory_helper.get_outbound_available_quantity",
        new=AsyncMock(return_value=Decimal("0")),
    ), patch(
        "apps.master_data.models.warehouse.Warehouse.get_or_none",
        new=AsyncMock(return_value=wh_selected),
    ), patch(
        "apps.master_data.models.material.Material.get_or_none",
        new=AsyncMock(return_value=material),
    ), patch(
        "apps.master_data.services.material_service.resolve_primary_default_warehouse_from_material",
        new=AsyncMock(return_value=(1, "A仓")),
    ):
        with pytest.raises(BusinessLogicError, match="不能从 B仓 领料/出库"):
            await assert_outbound_warehouse_stock_available(
                tenant_id=1,
                material_id=10,
                warehouse_id=2,
                quantity=Decimal("5"),
            )
