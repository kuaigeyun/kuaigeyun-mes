"""SensitiveWordIpGuardService：按账号+IP 累计 3 次封禁，局域网同事不受影响。"""

import asyncio

import pytest

from core.services.content.sensitive_word_ip_guard import (
    MAX_STRIKES,
    SensitiveWordIpGuardService,
)
from infra.exceptions.exceptions import AuthorizationError, ValidationError


@pytest.fixture(autouse=True)
def memory_guard():
    SensitiveWordIpGuardService.use_memory_backend()
    yield
    SensitiveWordIpGuardService.reset_memory_backend()


def _u(*codes: int) -> str:
    return "".join(chr(code) for code in codes)


CN = _u(0x50BB, 0x903C)
LAN_IP = "203.0.113.9"


def test_first_violation_shows_reminder():
    guard = SensitiveWordIpGuardService.instance()
    exc = asyncio.run(
        guard.build_validation_error(LAN_IP, field="notes", matched=CN, user_id=11)
    )
    assert isinstance(exc, ValidationError)
    assert exc.details["strike_count"] == 1
    assert exc.details["ip_banned"] is False
    assert exc.details["user_id"] == 11
    assert "第 1 次违规" in exc.message
    assert str(MAX_STRIKES) in exc.message


def test_third_violation_bans_account_on_that_ip():
    guard = SensitiveWordIpGuardService.instance()
    for count in (1, 2):
        exc = asyncio.run(
            guard.build_validation_error(LAN_IP, field="notes", matched=CN, user_id=11)
        )
        assert exc.details["strike_count"] == count
        assert exc.details["ip_banned"] is False
    exc = asyncio.run(
        guard.build_validation_error(LAN_IP, field="notes", matched=CN, user_id=11)
    )
    assert exc.details["strike_count"] == 3
    assert exc.details["ip_banned"] is True
    assert "已被封禁" in exc.message
    assert asyncio.run(guard.is_banned(LAN_IP, 11)) is True


def test_same_lan_ip_does_not_ban_other_account():
    guard = SensitiveWordIpGuardService.instance()
    for _ in range(MAX_STRIKES):
        asyncio.run(guard.build_validation_error(LAN_IP, field="notes", matched=CN, user_id=11))
    assert asyncio.run(guard.is_banned(LAN_IP, 11)) is True
    assert asyncio.run(guard.is_banned(LAN_IP, 22)) is False
    asyncio.run(guard.ensure_ip_allowed(LAN_IP, user_id=22))
    exc = asyncio.run(
        guard.build_validation_error(LAN_IP, field="notes", matched=CN, user_id=22)
    )
    assert exc.details["strike_count"] == 1
    assert exc.details["ip_banned"] is False


def test_banned_account_can_login_from_other_ip():
    guard = SensitiveWordIpGuardService.instance()
    for _ in range(MAX_STRIKES):
        asyncio.run(guard.build_validation_error(LAN_IP, field="notes", matched=CN, user_id=11))
    asyncio.run(guard.ensure_ip_allowed("198.51.100.7", user_id=11))


def test_banned_account_cannot_login_from_same_ip():
    guard = SensitiveWordIpGuardService.instance()
    for _ in range(MAX_STRIKES):
        asyncio.run(guard.build_validation_error(LAN_IP, field="notes", matched=CN, user_id=11))
    with pytest.raises(AuthorizationError) as exc:
        asyncio.run(guard.ensure_ip_allowed(LAN_IP, user_id=11))
    assert "封禁" in exc.value.message


def test_anonymous_hit_does_not_ban_lan_ip():
    guard = SensitiveWordIpGuardService.instance()
    for _ in range(MAX_STRIKES):
        exc = asyncio.run(guard.build_validation_error(LAN_IP, field="notes", matched=CN))
        assert exc.details["strike_count"] == 0
        assert exc.details["ip_banned"] is False
    assert asyncio.run(guard.is_banned(LAN_IP)) is False
    asyncio.run(guard.ensure_ip_allowed(LAN_IP, user_id=11))
