import importlib.util
from pathlib import Path
import sys
import types

import pytest
from fastapi import HTTPException

from infra.exceptions.exceptions import NotFoundError, ValidationError

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))


_base_api_dir = Path(__file__).resolve().parents[2] / "src/apps/kuaizhizao/api"

_molds_spec = importlib.util.spec_from_file_location(
    "config_gate_molds_api", _base_api_dir / "molds/molds.py"
)
molds_api = importlib.util.module_from_spec(_molds_spec)
assert _molds_spec and _molds_spec.loader
_molds_spec.loader.exec_module(molds_api)

_tools_spec = importlib.util.spec_from_file_location(
    "config_gate_tools_api", _base_api_dir / "tools/tools.py"
)
tools_api = importlib.util.module_from_spec(_tools_spec)
assert _tools_spec and _tools_spec.loader
_tools_spec.loader.exec_module(tools_api)

_scheduling_spec = importlib.util.spec_from_file_location(
    "config_gate_scheduling_api", _base_api_dir / "scheduling_configs/scheduling_configs.py"
)
scheduling_api = importlib.util.module_from_spec(_scheduling_spec)
assert _scheduling_spec and _scheduling_spec.loader
_scheduling_spec.loader.exec_module(scheduling_api)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_molds_api_get_should_map_not_found_with_trace_id(monkeypatch):
    async def _raise_not_found(*args, **kwargs):
        raise NotFoundError("mold missing")

    monkeypatch.setattr(molds_api.MoldService, "get_mold_by_uuid", _raise_not_found)

    with pytest.raises(HTTPException) as exc:
        await molds_api.get_mold(uuid="m-1", tenant_id=1)

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert "mold missing" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_tools_api_create_should_map_validation_error_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("invalid tool payload")

    monkeypatch.setattr(tools_api.ToolService, "create_tool", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await tools_api.create_tool(data=None, current_user=None, tenant_id=1)

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "invalid tool payload"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_scheduling_configs_create_should_map_validation_error_with_trace_id(monkeypatch):
    async def _raise_validation_error(*args, **kwargs):
        raise ValidationError("invalid scheduling config")

    monkeypatch.setattr(scheduling_api.config_service, "create_config", _raise_validation_error)

    with pytest.raises(HTTPException) as exc:
        await scheduling_api.create_scheduling_config(
            config_data=None,
            current_user=type("U", (), {"id": 1})(),
            tenant_id=1,
        )

    assert exc.value.status_code == 400
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "invalid scheduling config"
    assert exc.value.detail.get("trace_id")
