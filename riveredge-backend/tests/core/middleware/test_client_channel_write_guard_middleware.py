"""ClientChannelWriteGuardMiddleware 单测。"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.middleware.client_channel_write_guard_middleware import ClientChannelWriteGuardMiddleware
from core.utils.client_channel import CLIENT_CHANNEL_HEADER
import infra.config.infra_config as infra_config_module


def _app(monkeypatch, *, enabled: bool = True) -> TestClient:
    class _Settings:
        CLIENT_CHANNEL_WRITE_GUARD_ENABLED = enabled

    monkeypatch.setattr(infra_config_module, "infra_settings", _Settings())

    app = FastAPI()
    app.add_middleware(ClientChannelWriteGuardMiddleware)

    @app.post("/api/v1/apps/kuaizhizao/sales-orders")
    async def create_so():
        return {"ok": True}

    @app.get("/api/v1/apps/kuaizhizao/sales-orders")
    async def list_so():
        return {"items": []}

    @app.post("/api/v1/auth/login")
    async def login():
        return {"token": "x"}

    @app.delete("/api/v1/apps/demo/1")
    async def delete_demo():
        return {"deleted": True}

    return TestClient(app)


def test_reject_write_without_channel(monkeypatch):
    client = _app(monkeypatch, enabled=True)
    r = client.post("/api/v1/apps/kuaizhizao/sales-orders", json={})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "AUTHORIZATION_ERROR"


def test_allow_write_with_pc_channel(monkeypatch):
    client = _app(monkeypatch, enabled=True)
    r = client.post(
        "/api/v1/apps/kuaizhizao/sales-orders",
        json={},
        headers={CLIENT_CHANNEL_HEADER: "pc"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_allow_write_with_integration_channel(monkeypatch):
    client = _app(monkeypatch, enabled=True)
    r = client.delete(
        "/api/v1/apps/demo/1",
        headers={CLIENT_CHANNEL_HEADER: "integration"},
    )
    assert r.status_code == 200


def test_get_not_guarded(monkeypatch):
    client = _app(monkeypatch, enabled=True)
    r = client.get("/api/v1/apps/kuaizhizao/sales-orders")
    assert r.status_code == 200


def test_login_exempt(monkeypatch):
    client = _app(monkeypatch, enabled=True)
    r = client.post("/api/v1/auth/login", json={"username": "a", "password": "b"})
    assert r.status_code == 200


def test_disabled_by_setting(monkeypatch):
    client = _app(monkeypatch, enabled=False)
    r = client.post("/api/v1/apps/kuaizhizao/sales-orders", json={})
    assert r.status_code == 200
