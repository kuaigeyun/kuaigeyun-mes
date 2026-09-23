"""interactive_client_guard 单测。"""

from types import SimpleNamespace

import pytest

from core.utils.interactive_client_guard import (
    assert_allowed_sales_order_create,
    assert_official_client_channel,
    is_client_channel_guard_exempt_path,
    request_has_official_client_channel,
    sales_order_create_has_upstream,
)
from infra.exceptions.exceptions import AuthorizationError


def _req(ua: str = "", channel: str | None = None):
    headers = {}
    if ua:
        headers["User-Agent"] = ua
    if channel:
        headers["X-Client-Channel"] = channel
    return SimpleNamespace(headers=headers)


def test_official_channel_whitelist():
    assert request_has_official_client_channel(_req(channel="pc"))
    assert request_has_official_client_channel(_req(channel="android"))
    assert request_has_official_client_channel(_req(channel="integration"))
    assert request_has_official_client_channel(_req(channel="api"))
    assert not request_has_official_client_channel(_req(channel="unknown-bot"))
    assert not request_has_official_client_channel(_req())


def test_exempt_paths():
    assert is_client_channel_guard_exempt_path("/api/v1/auth/login")
    assert is_client_channel_guard_exempt_path("/api/v1/auth/register/personal")
    assert is_client_channel_guard_exempt_path("/api/v1/auth/biometric/login-options")
    assert not is_client_channel_guard_exempt_path("/api/v1/apps/kuaizhizao/sales-orders")


def test_upstream_detection():
    assert sales_order_create_has_upstream(SimpleNamespace(contract_id=10))
    assert sales_order_create_has_upstream({"quotation_id": 5})
    assert not sales_order_create_has_upstream(SimpleNamespace(contract_id=0))


def test_reject_script_without_upstream_and_channel():
    with pytest.raises(AuthorizationError):
        assert_allowed_sales_order_create(
            _req("python-requests/2.32.5"),
            has_upstream=False,
        )


def test_allow_official_channel_no_upstream():
    assert_allowed_sales_order_create(
        _req(channel="pc"),
        has_upstream=False,
    )


def test_allow_script_with_upstream_contract():
    assert_allowed_sales_order_create(
        _req("python-requests/2.32.5"),
        has_upstream=True,
    )


def test_assert_official_client_channel():
    assert_official_client_channel(_req(channel="station"))
    with pytest.raises(AuthorizationError):
        assert_official_client_channel(_req("curl/8.0"))
