"""LoginBruteForceGuard 单元测试。"""

from unittest.mock import AsyncMock, patch

import pytest

from infra.exceptions.exceptions import RateLimitError
from infra.services.login_brute_force_guard import (
    LoginBruteForceGuard,
    normalize_login_identity,
)


@pytest.mark.parametrize(
    ("username", "tenant_id", "expected"),
    [
        ("Admin", None, "global:admin"),
        (" 13800138000 ", 42, "t42:13800138000"),
    ],
)
def test_normalize_login_identity(username, tenant_id, expected):
    assert normalize_login_identity(username, tenant_id) == expected


@pytest.mark.asyncio
async def test_check_raises_when_identity_locked():
    with patch(
        "infra.services.login_brute_force_guard.Cache.get",
        new=AsyncMock(side_effect=lambda key: "1" if "lock:ident:" in key else None),
    ):
        with pytest.raises(RateLimitError) as exc_info:
            await LoginBruteForceGuard.check("10.0.0.1", "global:alice")
    assert "尝试过多" in exc_info.value.message
    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_check_passes_when_not_locked():
    with patch(
        "infra.services.login_brute_force_guard.Cache.get",
        new=AsyncMock(return_value=None),
    ):
        await LoginBruteForceGuard.check("10.0.0.1", "global:alice")


@pytest.mark.asyncio
async def test_record_failure_locks_identity_at_threshold():
    store: dict[str, str] = {}

    async def fake_get(key: str):
        return store.get(key)

    async def fake_set(key: str, value: str, expire=None):
        store[key] = value
        return True

    with patch(
        "infra.services.login_brute_force_guard.infra_settings"
    ) as mock_settings, patch(
        "infra.services.login_brute_force_guard.Cache.get",
        new=AsyncMock(side_effect=fake_get),
    ), patch(
        "infra.services.login_brute_force_guard.Cache.set",
        new=AsyncMock(side_effect=fake_set),
    ):
        mock_settings.LOGIN_BRUTE_FORCE_IDENT_MAX_FAILURES = 3
        mock_settings.LOGIN_BRUTE_FORCE_IP_MAX_FAILURES = 100
        mock_settings.LOGIN_BRUTE_FORCE_WINDOW_SECONDS = 900
        mock_settings.LOGIN_BRUTE_FORCE_LOCK_SECONDS = 900

        identity = "global:bob"
        for _ in range(3):
            await LoginBruteForceGuard.record_failure("10.0.0.2", identity)

    assert store["auth:login:fail:ident:global:bob"] == "3"
    assert store["auth:login:lock:ident:global:bob"] == "1"


@pytest.mark.asyncio
async def test_clear_identity_removes_fail_and_lock_keys():
    with patch(
        "infra.services.login_brute_force_guard.Cache.delete",
        new=AsyncMock(),
    ) as mock_delete:
        await LoginBruteForceGuard.clear_identity("global:carol")

    deleted_keys = [call.args[0] for call in mock_delete.await_args_list]
    assert "auth:login:fail:ident:global:carol" in deleted_keys
    assert "auth:login:lock:ident:global:carol" in deleted_keys


@pytest.mark.asyncio
async def test_ip_and_identity_counters_are_independent():
    store: dict[str, str] = {}

    async def fake_get(key: str):
        return store.get(key)

    async def fake_set(key: str, value: str, expire=None):
        store[key] = value
        return True

    with patch(
        "infra.services.login_brute_force_guard.infra_settings"
    ) as mock_settings, patch(
        "infra.services.login_brute_force_guard.Cache.get",
        new=AsyncMock(side_effect=fake_get),
    ), patch(
        "infra.services.login_brute_force_guard.Cache.set",
        new=AsyncMock(side_effect=fake_set),
    ):
        mock_settings.LOGIN_BRUTE_FORCE_IDENT_MAX_FAILURES = 5
        mock_settings.LOGIN_BRUTE_FORCE_IP_MAX_FAILURES = 2
        mock_settings.LOGIN_BRUTE_FORCE_WINDOW_SECONDS = 900
        mock_settings.LOGIN_BRUTE_FORCE_LOCK_SECONDS = 900

        await LoginBruteForceGuard.record_failure("10.0.0.3", "global:dave")
        await LoginBruteForceGuard.record_failure("10.0.0.3", "global:eve")

    assert store["auth:login:lock:ip:10.0.0.3"] == "1"
    assert "auth:login:lock:ident:global:dave" not in store
    assert "auth:login:lock:ident:global:eve" not in store
