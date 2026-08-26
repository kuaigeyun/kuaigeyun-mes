from core.config.industry_pack import resolve_industry_pack_navigation_visible


def test_resolve_industry_pack_navigation_visible_requires_active_modules() -> None:
    assert resolve_industry_pack_navigation_visible(
        is_installed=True,
        active_module_count=0,
    ) is False
    assert resolve_industry_pack_navigation_visible(
        is_installed=True,
        active_module_count=1,
    ) is True
    assert resolve_industry_pack_navigation_visible(
        is_installed=False,
        active_module_count=1,
    ) is False
