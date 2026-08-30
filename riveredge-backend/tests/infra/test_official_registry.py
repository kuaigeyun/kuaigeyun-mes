"""official_registry 站点与开关判定测试。"""

from infra.constants.official_registry import (
    OFFICIAL_API_LIBRARY_BASE_URL,
    is_local_official_api_library_host,
    is_official_registry_host,
    is_registry_summary_admin_enabled,
    normalize_registry_host,
)


def test_normalize_registry_host_strips_port():
    assert normalize_registry_host("Kuaigeyun.com:443") == "kuaigeyun.com"


def test_is_official_registry_host():
    assert is_official_registry_host("www.kuaigeyun.com")
    assert not is_official_registry_host("localhost")
    assert not is_official_registry_host("evil-kuaigeyun.com")


def test_official_api_library_base_url_fixed():
    assert OFFICIAL_API_LIBRARY_BASE_URL == "https://kuaigeyun.com"


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
