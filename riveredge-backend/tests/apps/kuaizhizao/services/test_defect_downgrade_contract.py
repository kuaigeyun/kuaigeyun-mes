"""降级改判与处置校验契约。"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from infra.exceptions.exceptions import BusinessLogicError, ValidationError


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


def test_validate_return_requires_incoming_inspection():
    svc = DefectRecordService()
    defect = MagicMock(incoming_inspection_id=None, work_order_id=1, operation_id=1)
    with pytest.raises(BusinessLogicError, match="来料检验"):
        svc._validate_disposition_choice(defect, "return")


def test_validate_rework_requires_work_order():
    svc = DefectRecordService()
    defect = MagicMock(incoming_inspection_id=1, work_order_id=None, operation_id=None)
    with pytest.raises(BusinessLogicError, match="返工或报废"):
        svc._validate_disposition_choice(defect, "rework")


def test_validate_accept_allowed_without_work_order():
    svc = DefectRecordService()
    defect = MagicMock(incoming_inspection_id=1, work_order_id=None, operation_id=None)
    svc._validate_disposition_choice(defect, "accept")
