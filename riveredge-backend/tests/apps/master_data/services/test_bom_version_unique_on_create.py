"""BOM 新建：同物料同版本禁止追加合并。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.master_data.services.material_service import MaterialService
from infra.exceptions.exceptions import ValidationError


def _qs_exists(exists: bool):
    qs = MagicMock()
    qs.exists = AsyncMock(return_value=exists)
    return qs


@pytest.mark.asyncio
async def test_assert_bom_material_version_available_rejects_duplicate():
    with patch(
        "apps.master_data.services.material_service.BOM.filter",
        return_value=_qs_exists(True),
    ):
        with pytest.raises(ValidationError) as exc:
            await MaterialService._assert_bom_material_version_available(
                tenant_id=1,
                material_id=10,
                version="1.0",
            )
    assert "版本 1.0" in str(exc.value)
    assert "已存在" in str(exc.value)


@pytest.mark.asyncio
async def test_assert_bom_material_version_available_normalizes_blank():
    with patch(
        "apps.master_data.services.material_service.BOM.filter",
        return_value=_qs_exists(False),
    ) as filter_mock:
        ver = await MaterialService._assert_bom_material_version_available(
            tenant_id=1,
            material_id=10,
            version="  ",
        )
    assert ver == "1.0"
    kwargs = filter_mock.call_args.kwargs
    assert kwargs["version"] == "1.0"


@pytest.mark.asyncio
async def test_create_bom_batch_rejects_when_version_exists():
    material = SimpleNamespace(
        id=10,
        main_code="P001",
        code="P001",
        name="成品",
    )
    data = SimpleNamespace(
        material_id=10,
        version="1.0",
        items=[SimpleNamespace(component_id=20)],
        bom_code=None,
        bom_name=None,
        base_quantity=None,
    )

    with patch(
        "apps.master_data.services.material_service.Material.filter",
    ) as material_filter:
        material_qs = MagicMock()
        material_qs.first = AsyncMock(return_value=material)
        material_filter.return_value = material_qs

        with patch.object(
            MaterialService,
            "_assert_bom_material_version_available",
            new=AsyncMock(
                side_effect=ValidationError(
                    "该物料版本 1.0 的 BOM 已存在，请升版或编辑已有草稿，禁止重复创建同版本"
                )
            ),
        ) as assert_mock:
            with pytest.raises(ValidationError) as exc:
                await MaterialService.create_bom_batch(tenant_id=1, data=data)

    assert_mock.assert_awaited_once()
    assert "禁止重复创建同版本" in str(exc.value)
