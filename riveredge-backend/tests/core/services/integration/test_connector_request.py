import importlib.util
from pathlib import Path

import pytest

from core.config.integration_type_spec import (
    BUSINESS_SYSTEM_CONNECTOR_TYPES,
    assert_business_system_connector_type,
    is_business_system_connector_type,
)
from infra.exceptions.exceptions import ValidationError

_SRC = Path(__file__).resolve().parents[4] / "src"
_CONNECTOR_REQUEST_PATH = _SRC / "core/services/integration/connector_request.py"
_spec = importlib.util.spec_from_file_location("connector_request_mod", _CONNECTOR_REQUEST_PATH)
assert _spec and _spec.loader
_connector_request = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_connector_request)
resolve_connector_request = _connector_request.resolve_connector_request


class _FakeIntegrationConfig:
    def __init__(self, config: dict, *, is_active: bool = True, name: str = "测试连接器"):
        self.config = config
        self.is_active = is_active
        self.name = name

    def get_config(self) -> dict:
        return self.config


def test_business_system_connector_types_exclude_ai_and_storage():
    assert "kingdee_galaxy" in BUSINESS_SYSTEM_CONNECTOR_TYPES
    assert "deepseek" not in BUSINESS_SYSTEM_CONNECTOR_TYPES
    assert "tencent_cos" not in BUSINESS_SYSTEM_CONNECTOR_TYPES
    assert "amap" not in BUSINESS_SYSTEM_CONNECTOR_TYPES


def test_assert_business_system_connector_type_rejects_ai():
    with pytest.raises(ValueError):
        assert_business_system_connector_type("deepseek")


def test_is_business_system_connector_type_normalizes_legacy_alias():
    assert is_business_system_connector_type("kingdee") is True


def test_resolve_connector_request_builds_url_and_bearer_header():
    ic = _FakeIntegrationConfig(
        {
            "base_url": "https://erp.example.com",
            "auth_type": "bearer",
            "token": "abc123",
        }
    )
    url, headers = resolve_connector_request(ic, endpoint="/api/orders", headers={"X-Trace": "1"})
    assert url == "https://erp.example.com/api/orders"
    assert headers["Authorization"] == "Bearer abc123"
    assert headers["X-Trace"] == "1"


def test_resolve_connector_request_missing_base_url_raises():
    ic = _FakeIntegrationConfig({})
    with pytest.raises(ValidationError, match="base_url"):
        resolve_connector_request(ic, endpoint="/api/orders")


def test_resolve_connector_request_inactive_raises():
    ic = _FakeIntegrationConfig(
        {"base_url": "https://erp.example.com"},
        is_active=False,
        name="金蝶云星空",
    )
    with pytest.raises(ValidationError, match="已停用"):
        resolve_connector_request(ic, endpoint="/k3cloud/Kingdee.BOS.WebApi.ServicesStub")
