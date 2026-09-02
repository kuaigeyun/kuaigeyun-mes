"""enabled_apps 契约测试。"""

from core.services.application.enabled_apps import expand_requires_apps, read_requires_apps_from_manifest


def test_expand_requires_apps_includes_master_data_for_kuaizhizao():
    expanded = expand_requires_apps({"kuaizhizao"})
    assert "master-data" in expanded
    assert "kuaizhizao" in expanded


def test_kuaizhizao_manifest_declares_requires_apps():
    assert "master-data" in read_requires_apps_from_manifest("kuaizhizao")
