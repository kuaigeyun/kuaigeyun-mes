"""SensitiveWordMiddleware：JSON 写入拦截、GET/登录不扫、multipart 不扫二进制。"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.middleware.sensitive_word_middleware import SensitiveWordMiddleware
from core.services.content.sensitive_word_ip_guard import SensitiveWordIpGuardService
from core.services.content.sensitive_word_service import SensitiveWordService


def _u(*codes: int) -> str:
    return "".join(chr(code) for code in codes)


CN = _u(0x50BB, 0x903C)
EN = _u(0x66, 0x75, 0x63, 0x6B)


@pytest.fixture(autouse=True)
def memory_guard():
    SensitiveWordIpGuardService.use_memory_backend()
    yield
    SensitiveWordIpGuardService.reset_memory_backend()


def _app(monkeypatch) -> TestClient:
    service = SensitiveWordService(words=[CN, EN], allowlist=[])
    monkeypatch.setattr(SensitiveWordService, "instance", classmethod(lambda cls: service))

    app = FastAPI()
    app.add_middleware(SensitiveWordMiddleware)

    @app.post("/api/v1/demo")
    async def create_demo(payload: dict):
        return payload

    @app.get("/api/v1/demo")
    async def list_demo(q: str = ""):
        return {"q": q}

    @app.post("/api/v1/auth/login")
    async def login(payload: dict):
        return {"ok": True}

    @app.post("/api/v1/files/upload")
    async def upload():
        return {"ok": True}

    return TestClient(app)


def test_json_write_is_rejected_with_strike(monkeypatch):
    client = _app(monkeypatch)
    response = client.post("/api/v1/demo", json={"notes": f"这里有{CN}"})
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"]["matched"] == CN
    assert body["error"]["details"]["strike_count"] == 0
    assert body["error"]["details"]["ip_banned"] is False
    assert "不当用语" in body["error"]["message"]


def test_json_write_clean_passes(monkeypatch):
    client = _app(monkeypatch)
    response = client.post("/api/v1/demo", json={"notes": "正常备注"})
    assert response.status_code == 200
    assert response.json()["notes"] == "正常备注"


def test_get_is_not_scanned(monkeypatch):
    client = _app(monkeypatch)
    response = client.get("/api/v1/demo", params={"q": CN})
    assert response.status_code == 200
    assert response.json()["q"] == CN


def test_login_password_is_not_scanned(monkeypatch):
    client = _app(monkeypatch)
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": f"{EN}you"})
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_query_description_on_write_is_scanned(monkeypatch):
    client = _app(monkeypatch)
    response = client.post(f"/api/v1/demo?description={CN}", json={"notes": "ok"})
    assert response.status_code == 422
    assert response.json()["error"]["details"]["matched"] == CN


def test_multipart_binary_is_not_scanned_as_text(monkeypatch):
    client = _app(monkeypatch)
    response = client.post(
        "/api/v1/files/upload",
        files={"file": ("ok.png", b"\x89PNG" + CN.encode("utf-8") + b"binary", "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_anonymous_write_hit_does_not_ban_lan(monkeypatch):
    """未登录写入只拒内容，不按 IP 封禁，避免局域网误伤。"""
    client = _app(monkeypatch)
    for _ in range(3):
        rejected = client.post("/api/v1/demo", json={"notes": f"这里有{CN}"})
        assert rejected.status_code == 422
        assert rejected.json()["error"]["details"]["ip_banned"] is False
    response = client.post("/api/v1/demo", json={"notes": "正常备注"})
    assert response.status_code == 200
    assert response.json()["notes"] == "正常备注"


def test_tenant_control_off_skips_scan(monkeypatch):
    async def _off(_tenant_id):
        return False

    monkeypatch.setattr(
        "core.middleware.sensitive_word_middleware.get_request_tenant_id",
        lambda _request: 9,
    )
    monkeypatch.setattr(
        "core.middleware.sensitive_word_middleware.tenant_has_sensitive_word_control",
        _off,
    )
    client = _app(monkeypatch)
    response = client.post("/api/v1/demo", json={"notes": f"这里有{CN}"})
    assert response.status_code == 200
    assert response.json()["notes"] == f"这里有{CN}"


def test_tenant_control_on_still_rejects(monkeypatch):
    async def _on(_tenant_id):
        return True

    monkeypatch.setattr(
        "core.middleware.sensitive_word_middleware.get_request_tenant_id",
        lambda _request: 9,
    )
    monkeypatch.setattr(
        "core.middleware.sensitive_word_middleware.tenant_has_sensitive_word_control",
        _on,
    )
    client = _app(monkeypatch)
    response = client.post("/api/v1/demo", json={"notes": f"这里有{CN}"})
    assert response.status_code == 422
    assert response.json()["error"]["details"]["matched"] == CN
