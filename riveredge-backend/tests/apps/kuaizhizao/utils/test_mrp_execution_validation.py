"""MRP 执行前 scope 校验与自制件来源配置规则。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.utils.material_source_helper import (
    MANUFACTURING_MODE_ASSEMBLY,
    MANUFACTURING_MODE_FABRICATION,
    SOURCE_TYPE_MAKE,
    validate_material_source_config,
)
from apps.kuaizhizao.utils.mrp_execution_validation import (
    format_mrp_scope_blocking_message,
    raise_if_mrp_scope_blocking,
    scope_blocking_to_readiness_gaps,
    validate_mrp_scope_materials,
)
from infra.exceptions.exceptions import BusinessLogicError


def _make_material(
    *,
    material_id: int = 1,
    code: str = "M001",
    name: str = "Part",
    process_route_id=None,
    manufacturing_mode=None,
    source_type: str = SOURCE_TYPE_MAKE,
):
    source_config = {}
    if manufacturing_mode:
        source_config["manufacturing_mode"] = manufacturing_mode
    return SimpleNamespace(
        id=material_id,
        main_code=code,
        name=name,
        process_route_id=process_route_id,
        source_config=source_config,
        source_type=source_type,
        uuid="uuid-1",
        specification=None,
        base_unit="PCS",
        deleted_at=None,
    )


@pytest.mark.asyncio
async def test_make_unset_no_bom_no_route_blocking():
    material = _make_material()
    mock_bom_q = MagicMock()
    mock_bom_q.count = AsyncMock(return_value=0)
    with patch(
        "apps.kuaizhizao.utils.material_source_helper.Material.get_or_none",
        new_callable=AsyncMock,
        return_value=material,
    ), patch(
        "apps.master_data.models.material.BOM.filter",
        return_value=mock_bom_q,
    ):
        passed, errors = await validate_material_source_config(1, 1, SOURCE_TYPE_MAKE)
    assert passed is False
    assert len(errors) == 2
    assert any("BOM" in e for e in errors)
    assert any("工艺路线" in e for e in errors)


@pytest.mark.asyncio
async def test_make_unset_only_route_no_bom_blocking():
    material = _make_material(process_route_id=99)
    mock_bom_q = MagicMock()
    mock_bom_q.count = AsyncMock(return_value=0)
    with patch(
        "apps.kuaizhizao.utils.material_source_helper.Material.get_or_none",
        new_callable=AsyncMock,
        return_value=material,
    ), patch(
        "apps.master_data.models.material.BOM.filter",
        return_value=mock_bom_q,
    ):
        passed, errors = await validate_material_source_config(1, 1, SOURCE_TYPE_MAKE)
    assert passed is False
    assert any("BOM" in e for e in errors)


@pytest.mark.asyncio
async def test_fabrication_route_no_bom_passes():
    material = _make_material(
        process_route_id=10,
        manufacturing_mode=MANUFACTURING_MODE_FABRICATION,
    )
    mock_bom_q = MagicMock()
    mock_bom_q.count = AsyncMock(return_value=0)
    with patch(
        "apps.kuaizhizao.utils.material_source_helper.Material.get_or_none",
        new_callable=AsyncMock,
        return_value=material,
    ), patch(
        "apps.master_data.models.material.BOM.filter",
        return_value=mock_bom_q,
    ):
        passed, errors = await validate_material_source_config(1, 1, SOURCE_TYPE_MAKE)
    assert passed is True
    assert errors == []


@pytest.mark.asyncio
async def test_assembly_bom_no_route_passes():
    material = _make_material(manufacturing_mode=MANUFACTURING_MODE_ASSEMBLY)
    mock_bom_q = MagicMock()
    mock_bom_q.count = AsyncMock(return_value=1)
    with patch(
        "apps.kuaizhizao.utils.material_source_helper.Material.get_or_none",
        new_callable=AsyncMock,
        return_value=material,
    ), patch(
        "apps.master_data.models.material.BOM.filter",
        return_value=mock_bom_q,
    ):
        passed, errors = await validate_material_source_config(1, 1, SOURCE_TYPE_MAKE)
    assert passed is True
    assert errors == []


@pytest.mark.asyncio
async def test_validate_mrp_scope_materials_blocking_for_unset_make():
    material = _make_material(material_id=10, code="SUB01")
    with patch(
        "apps.kuaizhizao.utils.mrp_execution_validation.MaterialService.batch_check_has_bom",
        new_callable=AsyncMock,
        return_value={10: False},
    ), patch(
        "apps.kuaizhizao.utils.mrp_execution_validation.Material.get_or_none",
        new_callable=AsyncMock,
        return_value=material,
    ), patch(
        "apps.kuaizhizao.utils.mrp_execution_validation.validate_material_source_config",
        new_callable=AsyncMock,
        return_value=(False, ["自制件必须有BOM配置，物料: SUB01 (Part)"]),
    ):
        result = await validate_mrp_scope_materials(1, [10], {}, set())
    assert result["blocking_count"] == 1
    assert result["blocking_errors"][0]["material_code"] == "SUB01"


def test_format_mrp_scope_blocking_message():
    result = {
        "blocking_errors": [
            {"material_code": "A", "material_id": 1, "messages": ["err"]},
            {"material_code": "B", "material_id": 2, "messages": ["err"]},
        ]
    }
    msg = format_mrp_scope_blocking_message(result)
    assert "A" in msg
    assert "B" in msg
    assert "2" in msg


def test_raise_if_scope_blocking_raises():
    with pytest.raises(BusinessLogicError):
        raise_if_mrp_scope_blocking({"blocking_count": 1, "blocking_errors": [{"material_code": "X"}]})


def test_raise_if_scope_blocking_passes():
    raise_if_mrp_scope_blocking({"blocking_count": 0, "blocking_errors": []})


def test_scope_blocking_to_readiness_gaps_maps_process_route():
    material = _make_material(
        material_id=3,
        code="CP0003",
        name="钢笔",
        manufacturing_mode=MANUFACTURING_MODE_FABRICATION,
    )
    result = {
        "blocking_errors": [
            {
                "material_id": 3,
                "material_code": "CP0003",
                "material_name": "钢笔",
                "messages": ["工艺型自制件必须有工艺路线配置，物料: CP0003 (钢笔)"],
            }
        ]
    }
    gaps = scope_blocking_to_readiness_gaps(result, material_by_id={3: material})
    assert len(gaps) == 1
    assert gaps[0]["field"] == "process_route_id"
    assert gaps[0]["value_type"] == "process_route_id"


def test_scope_blocking_to_readiness_gaps_bom_is_info_only():
    material = _make_material(material_id=4, code="M004")
    result = {
        "blocking_errors": [
            {
                "material_id": 4,
                "material_code": "M004",
                "material_name": "Part",
                "messages": ["自制件必须有BOM配置，物料: M004 (Part)"],
            }
        ]
    }
    gaps = scope_blocking_to_readiness_gaps(result, material_by_id={4: material})
    assert gaps[0]["field"] == "_bom"
    assert gaps[0]["value_type"] == "info"
