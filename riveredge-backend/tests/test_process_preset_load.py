"""工序行业预设加载逻辑单测（DB 层以 mock 隔离）。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import apps.master_data.services.process_service as process_service_mod
from apps.master_data.services.process_preset_catalog import preset_catalog_for_api
from apps.master_data.services.process_service import ProcessService
from infra.exceptions.exceptions import ValidationError


def test_preset_catalog_for_api_structure():
    data = preset_catalog_for_api()
    assert "industries" in data
    assert len(data["industries"]) >= 1
    first = data["industries"][0]
    assert "id" in first and "name" in first
    assert first["operations"]
    op0 = first["operations"][0]
    assert "presetKey" in op0 and "name" in op0 and "defectPresets" in op0


@pytest.mark.asyncio
async def test_load_preset_operations_by_industry_unknown_industry():
    with pytest.raises(ValidationError, match="未知行业"):
        await ProcessService.load_preset_operations_by_industry(1, "no_such_industry", ["x"])


@pytest.mark.asyncio
async def test_load_preset_operations_by_industry_empty_keys():
    out = await ProcessService.load_preset_operations_by_industry(1, "machining", [])
    assert out["created_operations"] == 0
    assert out["message"]


@pytest.mark.asyncio
async def test_load_preset_operations_by_industry_invalid_key():
    with pytest.raises(ValidationError, match="presetKey"):
        await ProcessService.load_preset_operations_by_industry(
            1, "machining", ["machining__blanking", "invalid__key"]
        )


@pytest.mark.asyncio
async def test_load_preset_operations_by_industry_creates_one_operation():
    tenant_id = 1
    mock_op = MagicMock()
    mock_op.id = 100

    mock_qs = MagicMock()
    mock_qs.first = AsyncMock(return_value=None)

    op_create = AsyncMock(return_value=mock_op)

    with (
        patch.object(
            ProcessService,
            "_resolve_or_create_defect_for_preset",
            new_callable=AsyncMock,
        ) as rdef,
        patch.object(
            process_service_mod.CodeGenerationService,
            "generate_code",
            new_callable=AsyncMock,
        ) as gen,
        patch.object(process_service_mod.Operation, "filter", return_value=mock_qs),
        patch.object(process_service_mod.Operation, "create", op_create),
        patch.object(
            process_service_mod,
            "_sync_operation_defect_types",
            new_callable=AsyncMock,
        ) as sync,
    ):
        gen.side_effect = ["OP001", "DT001", "DT002", "DT003"]
        rdef.side_effect = [("u1", True), ("u2", True), ("u3", True)]

        result = await ProcessService.load_preset_operations_by_industry(
            tenant_id, "machining", ["machining__blanking"]
        )

        assert result["created_operations"] == 1
        assert result["skipped_operations"] == 0
        assert result["created_defect_types"] == 3
        assert result["reused_defect_types"] == 0
        assert result["linked_pairs"] == 3
        op_create.assert_awaited_once()
        sync.assert_awaited_once()
        call_args = sync.await_args[0]
        assert call_args[0] == 100
        assert call_args[1] == ["u1", "u2", "u3"]
        assert call_args[2] == tenant_id
