"""金蝶苍穹 access_token 缓存：TTL、缓存键与换票复用。"""

from unittest.mock import AsyncMock, patch

import pytest

from core.services.integration import kingdee_cosmic_service as cosmic


def _sample_config(**overrides):
    cfg = {
        "base_url": "https://tenant.kdgalaxy.com",
        "client_id": "ZD_MES",
        "client_secret": "secret-1",
        "username": "proxy_user",
        "account_id": "acct-1",
        "x_acgw_identity": "identity-abc",
    }
    cfg.update(overrides)
    return cfg


@pytest.fixture(autouse=True)
def _clear_memory_token_cache():
    cosmic._MEMORY_TOKEN_CACHE.clear()
    cosmic._TOKEN_LOCKS.clear()
    yield
    cosmic._MEMORY_TOKEN_CACHE.clear()
    cosmic._TOKEN_LOCKS.clear()


def test_token_cache_ttl_subtracts_skew():
    assert cosmic.token_cache_ttl_seconds(7000) == 7000 - cosmic.TOKEN_REFRESH_SKEW_SECONDS
    assert cosmic.token_cache_ttl_seconds(None) == (
        cosmic.DEFAULT_TOKEN_EXPIRES_IN - cosmic.TOKEN_REFRESH_SKEW_SECONDS
    )
    assert cosmic.token_cache_ttl_seconds(10) == 60


def test_is_kingdee_cosmic_access_token_rejected():
    assert cosmic.is_kingdee_cosmic_access_token_rejected(None, http_status=401)
    assert cosmic.is_kingdee_cosmic_access_token_rejected(
        {
            "data": None,
            "errorCode": "401",
            "message": "AccessToken认证不通过, token已过期,TraceId: abc",
            "status": False,
        }
    )
    assert not cosmic.is_kingdee_cosmic_access_token_rejected(
        {"errorCode": "2530", "message": "Cannot found OpenAPI"},
        http_status=200,
    )


def test_token_cache_key_stable_and_changes_with_secret():
    key1 = cosmic.build_kingdee_cosmic_token_cache_key(_sample_config())
    key2 = cosmic.build_kingdee_cosmic_token_cache_key(_sample_config())
    assert key1 == key2
    assert key1.startswith("riveredge:kingdee_cosmic:access_token:")
    key_secret = cosmic.build_kingdee_cosmic_token_cache_key(
        _sample_config(client_secret="secret-2")
    )
    assert key_secret != key1
    key_user = cosmic.build_kingdee_cosmic_token_cache_key(
        _sample_config(username="other")
    )
    assert key_user != key1


@pytest.mark.asyncio
async def test_login_reuses_cached_token_without_second_get_token():
    cfg = _sample_config()
    fake_result = {
        "success": True,
        "message": "ok",
        "token_url": "https://tenant.kdgalaxy.com/kapi/oauth2/getToken",
        "data": {
            "access_token": "tok-abc",
            "token_type": "Bearer",
            "expires_in": 7000,
            "id_token": None,
        },
    }
    with patch.object(
        cosmic,
        "_request_kingdee_cosmic_access_token",
        new=AsyncMock(return_value=fake_result),
    ) as mocked:
        first = await cosmic.login_kingdee_cosmic_session(cfg)
        second = await cosmic.login_kingdee_cosmic_session(cfg)
        assert first["access_token"] == "tok-abc"
        assert second["access_token"] == "tok-abc"
        assert mocked.await_count == 1


@pytest.mark.asyncio
async def test_login_force_refresh_fetches_again():
    cfg = _sample_config()
    call_n = {"n": 0}

    async def _fake_request(_config):
        call_n["n"] += 1
        return {
            "success": True,
            "message": "ok",
            "token_url": "https://tenant.kdgalaxy.com/kapi/oauth2/getToken",
            "data": {
                "access_token": f"tok-{call_n['n']}",
                "token_type": "Bearer",
                "expires_in": 7000,
            },
        }

    with patch.object(
        cosmic,
        "_request_kingdee_cosmic_access_token",
        new=AsyncMock(side_effect=_fake_request),
    ):
        first = await cosmic.login_kingdee_cosmic_session(cfg)
        second = await cosmic.login_kingdee_cosmic_session(cfg, force_refresh=True)
        assert first["access_token"] == "tok-1"
        assert second["access_token"] == "tok-2"


@pytest.mark.asyncio
async def test_invalidate_clears_memory_cache():
    cfg = _sample_config()
    fake_result = {
        "success": True,
        "message": "ok",
        "token_url": "https://tenant.kdgalaxy.com/kapi/oauth2/getToken",
        "data": {"access_token": "tok-x", "expires_in": 7000},
    }
    with patch.object(
        cosmic,
        "_request_kingdee_cosmic_access_token",
        new=AsyncMock(return_value=fake_result),
    ) as mocked:
        await cosmic.login_kingdee_cosmic_session(cfg)
        await cosmic.invalidate_kingdee_cosmic_token_cache(cfg)
        await cosmic.login_kingdee_cosmic_session(cfg)
        assert mocked.await_count == 2
