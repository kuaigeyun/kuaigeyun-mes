"""菜单同步状态检测。"""

from core.services.application.application_service import ApplicationService


def test_stable_menu_config_digest_same_structure():
    config = {
        "title": "销售",
        "children": [{"title": "订单", "path": "/apps/kuaizhizao/sales/orders"}],
    }
    assert ApplicationService.stable_menu_config_digest(config) == ApplicationService.stable_menu_config_digest(
        dict(config),
    )


def test_stable_menu_config_digest_differs_when_structure_changes():
    before = {"title": "销售", "children": [{"title": "订单", "path": "/a"}]}
    after = {"title": "销售", "children": [{"title": "订单", "path": "/b"}]}
    assert ApplicationService.stable_menu_config_digest(before) != ApplicationService.stable_menu_config_digest(after)


def test_stable_menu_config_digest_empty():
    assert ApplicationService.stable_menu_config_digest(None) == "empty"


def test_is_orphaned_manifest_menu_row_detects_root_level_folder():
    assert ApplicationService._is_orphaned_manifest_menu_row(
        name="app.kuaizhizao.menu.performance-management",
        path=None,
        parent_id=None,
        application_uuid="00000000-0000-0000-0000-000000000001",
        app_code="kuaizhizao",
    )


def test_is_orphaned_manifest_menu_row_ignores_app_root():
    assert not ApplicationService._is_orphaned_manifest_menu_row(
        name="app.kuaizhizao.name",
        path="/apps/kuaizhizao",
        parent_id=None,
        application_uuid="00000000-0000-0000-0000-000000000001",
        app_code="kuaizhizao",
    )


def test_is_orphaned_manifest_menu_row_ignores_valid_child():
    assert not ApplicationService._is_orphaned_manifest_menu_row(
        name="app.kuaizhizao.menu.performance-management",
        path=None,
        parent_id=42,
        application_uuid="00000000-0000-0000-0000-000000000001",
        app_code="kuaizhizao",
    )


def test_collect_manifest_menu_paths_nested():
    config = {
        "path": "/apps/kuaizhizao",
        "children": [
            {
                "title": "outsource",
                "children": [
                    {"path": "/apps/kuaizhizao/outsource-management/dashboard"},
                ],
            },
        ],
    }
    paths = ApplicationService.collect_manifest_menu_paths(config)
    assert "/apps/kuaizhizao" in paths
    assert "/apps/kuaizhizao/outsource-management/dashboard" in paths


def test_collect_manifest_leaf_immediate_parent_titles_grouped_finance():
    config = {
        "title": "app.kuaicaiwu.name",
        "children": [
            {
                "title": "app.kuaicaiwu.menu.finance-management",
                "children": [
                    {
                        "title": "app.kuaicaiwu.menu.group.finance-receipts",
                        "children": [
                            {
                                "title": "app.kuaicaiwu.menu.finance-management.receivables",
                                "path": "/apps/kuaizhizao/finance-management/receivables",
                            },
                        ],
                    },
                ],
            },
        ],
    }
    parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(config)
    assert (
        parents["/apps/kuaizhizao/finance-management/receivables"]
        == "app.kuaicaiwu.menu.group.finance-receipts"
    )


def test_collect_manifest_leaf_immediate_parent_titles_flat_finance_differs():
    grouped = {
        "title": "app.kuaicaiwu.name",
        "children": [
            {
                "title": "app.kuaicaiwu.menu.finance-management",
                "children": [
                    {
                        "title": "app.kuaicaiwu.menu.group.finance-receipts",
                        "children": [
                            {
                                "path": "/apps/kuaizhizao/finance-management/receivables",
                            },
                        ],
                    },
                ],
            },
        ],
    }
    flat = {
        "title": "app.kuaicaiwu.name",
        "children": [
            {
                "title": "app.kuaicaiwu.menu.finance-management",
                "children": [
                    {
                        "title": "app.kuaicaiwu.menu.finance-management.receivables",
                        "path": "/apps/kuaizhizao/finance-management/receivables",
                    },
                ],
            },
        ],
    }
    grouped_parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(grouped)
    flat_parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(flat)
    assert grouped_parents["/apps/kuaizhizao/finance-management/receivables"] != flat_parents[
        "/apps/kuaizhizao/finance-management/receivables"
    ]
