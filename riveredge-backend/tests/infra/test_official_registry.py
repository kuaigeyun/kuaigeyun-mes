"""official_registry 站点与开关判定测试。"""

from infra.constants.official_registry import (
    DEFAULT_OFFICIAL_API_LIBRARY_HOST,
    OFFICIAL_API_LIBRARY_BASE_URL,
    base_url_for_official_api_library_host,
    is_local_official_api_library_host,
    is_official_registry_host,
    is_registry_summary_admin_enabled,
    is_request_on_official_api_library_host,
    normalize_official_api_library_host_input,
    normalize_registry_host,
    official_api_library_host_candidates,
)


def test_normalize_registry_host_strips_port():
    assert normalize_registry_host("Kuaigeyun.com:443") == "kuaigeyun.com"


def test_is_official_registry_host():
    assert is_official_registry_host("www.kuaigeyun.com")
    assert not is_official_registry_host("localhost")
    assert not is_official_registry_host("evil-kuaigeyun.com")


def test_official_api_library_base_url_fixed_default():
    assert OFFICIAL_API_LIBRARY_BASE_URL == "https://kuaigeyun.com"
    assert DEFAULT_OFFICIAL_API_LIBRARY_HOST == "kuaigeyun.com"
    assert base_url_for_official_api_library_host("") == "https://kuaigeyun.com"


def test_normalize_official_api_library_host_input():
    assert normalize_official_api_library_host_input("https://www.kuaigeyun.com/path") == "kuaigeyun.com"
    assert normalize_official_api_library_host_input("Example.COM") == "example.com"


def test_request_on_configured_host():
    assert is_request_on_official_api_library_host("kuaigeyun.com", "kuaigeyun.com")
    assert is_request_on_official_api_library_host("www.kuaigeyun.com", "kuaigeyun.com")
    assert not is_request_on_official_api_library_host("customer.example.com", "kuaigeyun.com")
    assert "www.example.com" in official_api_library_host_candidates("example.com")


def test_is_registry_summary_admin_enabled(monkeypatch):
    from infra.config import infra_config

    monkeypatch.setattr(infra_config.infra_settings, "INSTALL_REPO_SUMMARY_ADMIN_ENABLED", False)
    monkeypatch.setattr(infra_config.infra_settings, "ENVIRONMENT", "production")
    assert is_registry_summary_admin_enabled() is False
    assert is_local_official_api_library_host() is False
    monkeypatch.setattr(infra_config.infra_settings, "INSTALL_REPO_SUMMARY_ADMIN_ENABLED", True)
    assert is_registry_summary_admin_enabled() is True
    assert is_local_official_api_library_host() is True


def test_local_official_api_library_host_in_development(monkeypatch):
    from infra.config import infra_config

    monkeypatch.setattr(infra_config.infra_settings, "INSTALL_REPO_SUMMARY_ADMIN_ENABLED", False)
    monkeypatch.setattr(infra_config.infra_settings, "ENVIRONMENT", "development")
    assert is_local_official_api_library_host() is True
