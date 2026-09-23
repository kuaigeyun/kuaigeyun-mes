"""写防护：限流 + 幂等中间件单测。"""

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from core.middleware.api_idempotency_middleware import ApiIdempotencyMiddleware
from core.middleware.api_write_rate_limit_middleware import ApiWriteRateLimitMiddleware
from core.utils.client_channel import CLIENT_CHANNEL_HEADER
import infra.config.infra_config as infra_config_module


def _settings(**over):
    class S:
        API_WRITE_RATE_LIMIT_ENABLED = True
        API_WRITE_RATE_LIMIT_PER_MINUTE = 5
        API_CRITICAL_WRITE_RATE_LIMIT_PER_MINUTE = 2
        API_IDEMPOTENCY_GUARD_ENABLED = True
        API_IDEMPOTENCY_TTL_SECONDS = 60
        API_IDEMPOTENCY_SOFT_TTL_SECONDS = 5
        CLIENT_CHANNEL_WRITE_GUARD_ENABLED = False

    for k, v in over.items():
        setattr(S, k, v)
    return S()


def _app(monkeypatch, *, middlewares: list):
    monkeypatch.setattr(infra_config_module, "infra_settings", _settings())
    app = FastAPI()
    for mw in middlewares:
        app.add_middleware(mw)

    @app.post("/api/v1/apps/kuaizhizao/sales-orders/1/approve")
    async def approve():
        return {"ok": True}

    @app.post("/api/v1/apps/kuaizhizao/sales-orders")
    async def create():
        return {"ok": True}

    return TestClient(app)


def test_rate_limit_critical_path(monkeypatch):
    # 注入假身份，避免限流落到 IP 桶
    from core.middleware import api_write_rate_limit_middleware as m

    monkeypatch.setattr(m, "get_request_user_id", lambda r: 7)
    monkeypatch.setattr(m, "get_request_tenant_id", lambda r: 1)

    client = _app(monkeypatch, middlewares=[ApiWriteRateLimitMiddleware])
    headers = {CLIENT_CHANNEL_HEADER: "pc"}
    assert client.post("/api/v1/apps/kuaizhizao/sales-orders/1/approve", headers=headers).status_code == 200
    assert client.post("/api/v1/apps/kuaizhizao/sales-orders/1/approve", headers=headers).status_code == 200
    r = client.post("/api/v1/apps/kuaizhizao/sales-orders/1/approve", headers=headers)
    assert r.status_code == 429


def test_soft_idempotency_on_approve(monkeypatch):
    from core.middleware import api_idempotency_middleware as m

    monkeypatch.setattr(m, "get_request_user_id", lambda r: 9)
    monkeypatch.setattr(m, "get_request_tenant_id", lambda r: 1)

    client = _app(monkeypatch, middlewares=[ApiIdempotencyMiddleware])
    headers = {CLIENT_CHANNEL_HEADER: "pc"}
    assert client.post("/api/v1/apps/kuaizhizao/sales-orders/1/approve", headers=headers).status_code == 200
    r2 = client.post("/api/v1/apps/kuaizhizao/sales-orders/1/approve", headers=headers)
    assert r2.status_code == 409


def test_explicit_idempotency_replays_body(monkeypatch):
    from core.middleware import api_idempotency_middleware as m

    monkeypatch.setattr(m, "get_request_user_id", lambda r: 3)
    monkeypatch.setattr(m, "get_request_tenant_id", lambda r: 1)

    client = _app(monkeypatch, middlewares=[ApiIdempotencyMiddleware])
    headers = {CLIENT_CHANNEL_HEADER: "pc", "Idempotency-Key": "abc-123"}
    r1 = client.post("/api/v1/apps/kuaizhizao/sales-orders", headers=headers)
    assert r1.status_code == 200
    r2 = client.post("/api/v1/apps/kuaizhizao/sales-orders", headers=headers)
    assert r2.status_code == 200
    assert r2.headers.get("X-Idempotency-Replay") == "1"
    assert r2.json() == r1.json()
