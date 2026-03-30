import pytest
from fastapi import HTTPException

from core.api.deps import deps as core_deps


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reject_header_tenant_mismatch_for_normal_user(monkeypatch):
    monkeypatch.setattr(core_deps, "get_infra_superadmin_token_payload", lambda _token: None)
    monkeypatch.setattr(core_deps, "get_token_payload", lambda _token: {"sub": 1, "tenant_id": 1})
    monkeypatch.setattr(core_deps, "get_tenant_id_from_context", lambda: None)
    monkeypatch.setattr(core_deps, "set_current_tenant_id", lambda _tenant_id: None)

    with pytest.raises(HTTPException) as exc_info:
        await core_deps.get_current_tenant(x_tenant_id="2", token="normal-token")

    assert exc_info.value.status_code == 403
    assert "租户上下文不匹配" in str(exc_info.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_allow_header_tenant_match_for_normal_user(monkeypatch):
    called = {}

    monkeypatch.setattr(core_deps, "get_infra_superadmin_token_payload", lambda _token: None)
    monkeypatch.setattr(core_deps, "get_token_payload", lambda _token: {"sub": 1, "tenant_id": 7})
    monkeypatch.setattr(core_deps, "get_tenant_id_from_context", lambda: None)
    monkeypatch.setattr(core_deps, "set_current_tenant_id", lambda tenant_id: called.setdefault("tenant_id", tenant_id))

    tenant_id = await core_deps.get_current_tenant(x_tenant_id="7", token="normal-token")
    assert tenant_id == 7
    assert called["tenant_id"] == 7


@pytest.mark.unit
@pytest.mark.asyncio
async def test_infra_superadmin_can_select_tenant_by_header(monkeypatch):
    monkeypatch.setattr(core_deps, "get_infra_superadmin_token_payload", lambda _token: {"sub": 999})
    monkeypatch.setattr(core_deps, "get_token_payload", lambda _token: None)
    monkeypatch.setattr(core_deps, "get_tenant_id_from_context", lambda: None)
    monkeypatch.setattr(core_deps, "set_current_tenant_id", lambda _tenant_id: None)

    tenant_id = await core_deps.get_current_tenant(x_tenant_id="88", token="infra-token")
    assert tenant_id == 88
