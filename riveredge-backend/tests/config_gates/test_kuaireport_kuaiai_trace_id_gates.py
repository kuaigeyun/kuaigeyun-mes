import sys
import types

import pytest
from fastapi import HTTPException

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaireport.api import dashboard as dashboard_api
from apps.kuaireport.api import report as report_api
from apps.kuaiai.api import suggestions as suggestions_api


@pytest.mark.unit
@pytest.mark.asyncio
async def test_dashboard_shared_should_map_not_found_with_trace_id(monkeypatch):
    async def _return_none(*args, **kwargs):
        return None

    monkeypatch.setattr(dashboard_api.dashboard_service, "get_by_share_token", _return_none)

    with pytest.raises(HTTPException) as exc:
        await dashboard_api.get_dashboard_by_share_token(token="bad-token")

    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("message") == "分享链接无效或已过期"
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_report_list_system_should_map_internal_error_with_trace_id(monkeypatch):
    async def _raise_error(*args, **kwargs):
        raise RuntimeError("list report failed")

    monkeypatch.setattr(report_api.report_service, "list_system_reports", _raise_error)

    with pytest.raises(HTTPException) as exc:
        await report_api.list_system_reports(skip=0, limit=20, current_user=types.SimpleNamespace(id=1), tenant_id=1)

    assert exc.value.status_code == 500
    assert isinstance(exc.value.detail, dict)
    assert "list report failed" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_kuaiai_inventory_should_map_internal_error_with_trace_id(monkeypatch):
    async def _raise_error(*args, **kwargs):
        raise RuntimeError("inventory suggestion failed")

    monkeypatch.setattr(
        "apps.kuaiai.services.suggestion_service.SuggestionService.get_suggestions_for_inventory",
        _raise_error,
    )

    with pytest.raises(HTTPException) as exc:
        await suggestions_api.get_inventory_suggestions(
            current_user=types.SimpleNamespace(id=1),
            tenant_id=1,
        )

    assert exc.value.status_code == 500
    assert isinstance(exc.value.detail, dict)
    assert "inventory suggestion failed" in exc.value.detail.get("message", "")
    assert exc.value.detail.get("trace_id")
