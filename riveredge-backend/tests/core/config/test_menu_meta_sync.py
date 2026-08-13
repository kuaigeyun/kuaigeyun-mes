"""菜单同步 meta 合并：保留运行时展示名覆盖。"""

from core.config.menu_takeover import (
    META_DISPLAY_NAME,
    META_SUPPRESSED_BY_TAKEOVER,
    merge_menu_meta_for_sync,
)


def test_merge_keeps_display_name_when_manifest_has_no_meta():
    existing = {META_DISPLAY_NAME: "销售", META_SUPPRESSED_BY_TAKEOVER: "kuaiplm"}
    assert merge_menu_meta_for_sync(existing, None) == existing


def test_merge_keeps_display_name_when_manifest_overwrites_other_keys():
    existing = {META_DISPLAY_NAME: "销售", "icon_color": "old"}
    manifest = {"icon_color": "new", META_DISPLAY_NAME: "should-not-win"}
    merged = merge_menu_meta_for_sync(existing, manifest)
    assert merged is not None
    assert merged[META_DISPLAY_NAME] == "销售"
    assert merged["icon_color"] == "new"


def test_merge_does_not_inject_manifest_display_name_when_unset():
    existing = {META_SUPPRESSED_BY_TAKEOVER: "kuaiplm"}
    manifest = {META_DISPLAY_NAME: "injected"}
    merged = merge_menu_meta_for_sync(existing, manifest)
    assert merged is not None
    assert META_DISPLAY_NAME not in merged
    assert merged[META_SUPPRESSED_BY_TAKEOVER] == "kuaiplm"
