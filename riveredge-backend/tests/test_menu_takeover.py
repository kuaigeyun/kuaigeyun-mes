"""菜单接管规则与路径匹配"""

from core.config.menu_takeover import (
    META_SUPPRESSED_BY_TAKEOVER,
    MENU_TAKEOVER_RULES,
    path_matches_takeover_prefix,
)


def test_kuaiplm_takeover_rule():
    rule = MENU_TAKEOVER_RULES["kuaiplm"]
    assert rule.source_app_code == "master-data"
    assert path_matches_takeover_prefix("/apps/master-data/process/drawings", rule)
    assert path_matches_takeover_prefix("/apps/master-data/process", rule)
    assert not path_matches_takeover_prefix("/apps/master-data/materials", rule)
    assert not path_matches_takeover_prefix(None, rule)


def test_suppressed_meta_key():
    assert META_SUPPRESSED_BY_TAKEOVER == "suppressed_by_takeover"
