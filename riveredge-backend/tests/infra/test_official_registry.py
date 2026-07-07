"""official_registry 站点与开关判定测试。"""

from infra.constants.official_registry import (
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


def test_is_registry_summary_admin_enabled(monkeypatch):
    from infra.config import infra_config

    monkeypatch.setattr(infra_config.infra_settings, "INSTALL_REPO_SUMMARY_ADMIN_ENABLED", False)
    assert is_registry_summary_admin_enabled() is False
    monkeypatch.setattr(infra_config.infra_settings, "INSTALL_REPO_SUMMARY_ADMIN_ENABLED", True)
    assert is_registry_summary_admin_enabled() is True
