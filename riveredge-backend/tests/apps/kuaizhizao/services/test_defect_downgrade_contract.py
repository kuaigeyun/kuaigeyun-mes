"""降级改判：目标物料不得与原产品相同。"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from infra.exceptions.exceptions import ValidationError


def test_downgrade_rejects_same_product_material():
    defect = MagicMock(
        product_id=100,
        downgrade_material_id=100,
        downgrade_warehouse_id=1,
    )
    svc = DefectRecordService()

    with pytest.raises(ValidationError, match="不能与原不合格产品相同"):
        asyncio.run(svc._resolve_downgrade_targets(1, defect))


def test_downgrade_resolves_different_target_material():
    defect = MagicMock(
        product_id=100,
        downgrade_material_id=200,
        downgrade_warehouse_id=1,
    )
    material = MagicMock(name="改判品", main_code="FG002", code="FG002", base_unit="个")
    warehouse = MagicMock(name="成品仓")

    svc = DefectRecordService()
    with patch(
        "apps.master_data.models.material.Material.get_or_none",
        new=AsyncMock(return_value=material),
    ), patch(
        "apps.master_data.models.warehouse.Warehouse.get_or_none",
        new=AsyncMock(return_value=warehouse),
    ):
        result = asyncio.run(svc._resolve_downgrade_targets(1, defect))

    assert result[0] == 200
    assert result[1] == "FG002"
