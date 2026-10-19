"""菜单同步状态检测。"""

import pytest

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


def test_pick_manifest_folder_parent_prefers_sibling_under_same_parent():
    from types import SimpleNamespace

    from core.services.system.menu_service import MenuService

    leaf = SimpleNamespace(id=10, parent_id=100)
    folder_a = SimpleNamespace(
        id=20, parent_id=100, name="app.kuaicaiwu.menu.group.finance-receipts"
    )
    folder_b = SimpleNamespace(
        id=21, parent_id=200, name="app.kuaicaiwu.menu.group.finance-receipts"
    )
    picked = MenuService._pick_manifest_folder_parent([folder_a, folder_b], leaf)
    assert picked is folder_a


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


@pytest.mark.asyncio
async def test_bind_menu_config_prefers_disk_manifest_over_stale_db_snapshot():
    """有磁盘 manifest 时，不得用库内平铺 menu_config 作为同步真源。"""
    from unittest.mock import AsyncMock, patch

    flat = {
        "title": "app.kuaicaiwu.name",
        "path": "/apps/kuaicaiwu",
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
    disk = {
        "code": "kuaicaiwu",
        "version": "1.0.1",
        "menu_config": {
            "title": "app.kuaicaiwu.name",
            "path": "/apps/kuaicaiwu",
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
        },
    }
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.close = AsyncMock()

    with (
        patch.object(ApplicationService, "_get_manifest_by_code", return_value=disk),
        patch(
            "core.services.application.application_service.get_db_connection",
            new_callable=AsyncMock,
            return_value=conn,
        ),
    ):
        bound = await ApplicationService.bind_menu_config_to_disk_manifest(
            tenant_id=1,
            application_uuid="00000000-0000-0000-0000-0000000000aa",
            menu_config=flat,
            app_code="kuaicaiwu",
        )

    assert bound is not None
    parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(bound)
    assert (
        parents["/apps/kuaizhizao/finance-management/receivables"]
        == "app.kuaicaiwu.menu.group.finance-receipts"
    )
    conn.execute.assert_awaited()
    assert conn.execute.await_args.args[-1] == "1.0.1"
