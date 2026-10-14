"""菜单层级契约：manifest 真源 → core_menus，禁止读侧兜底（代码级验证）。"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.application.application_service import ApplicationService
from core.services.system.menu_service import MenuService
from infra.exceptions.exceptions import ValidationError

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_KUAIZHIZAO_MANIFEST = _BACKEND_ROOT / "src" / "apps" / "kuaizhizao" / "manifest.json"


def _load_kuaizhizao_menu_config() -> dict:
    assert _KUAIZHIZAO_MANIFEST.is_file(), f"缺少 manifest: {_KUAIZHIZAO_MANIFEST}"
    manifest = json.loads(_KUAIZHIZAO_MANIFEST.read_text(encoding="utf-8"))
    menu_config = manifest.get("menu_config")
    assert isinstance(menu_config, dict)
    return menu_config


def test_kuaizhizao_manifest_finance_receivables_parent_is_receipts_group():
    menu_config = _load_kuaizhizao_menu_config()
    parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(menu_config)
    path = "/apps/kuaizhizao/finance-management/receivables"
    assert parents[path] == "app.kuaicaiwu.menu.group.finance-receipts"


def test_kuaizhizao_manifest_finance_payables_parent_is_payments_group():
    menu_config = _load_kuaizhizao_menu_config()
    parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(menu_config)
    path = "/apps/kuaizhizao/finance-management/payables"
    assert parents[path] == "app.kuaicaiwu.menu.group.finance-payments"


def test_kuaizhizao_manifest_finance_grouped_paths_not_direct_under_finance_folder():
    """分组 manifest 下，应收/应付等不得声明为 finance-management 的直接子节点。"""
    menu_config = _load_kuaizhizao_menu_config()
    parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(menu_config)
    finance_folder = "app.kuaicaiwu.menu.finance-management"
    grouped_paths = [
        "/apps/kuaizhizao/finance-management/receivables",
        "/apps/kuaizhizao/finance-management/payables",
        "/apps/kuaizhizao/finance-management/receipts",
        "/apps/kuaizhizao/finance-management/payments",
    ]
    for path in grouped_paths:
        assert path in parents
        assert parents[path] != finance_folder
        assert ".menu.group." in parents[path]


def test_kuaicaiwu_takeover_children_are_materialized_from_kuaizhizao_manifest():
    consumer = {
        "code": "kuaicaiwu",
        "menu_config": {
            "children": [
                {
                    "title": "app.kuaicaiwu.menu.finance-management",
                    "meta": {"menu_takeover": "kuaizhizao-finance-management"},
                    "children": [],
                },
            ],
        },
    }
    source = {
        "code": "kuaizhizao",
        "menu_config": {
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

    with patch.object(
        ApplicationService,
        "_get_raw_manifest_by_code",
        return_value=source,
    ):
        materialized = ApplicationService._materialize_takeover_manifest(
            "kuaicaiwu",
            consumer,
        )

    parents = ApplicationService.collect_manifest_leaf_immediate_parent_titles(
        materialized["menu_config"]
    )
    assert (
        parents["/apps/kuaizhizao/finance-management/receivables"]
        == "app.kuaicaiwu.menu.group.finance-receipts"
    )
    assert consumer["menu_config"]["children"][0]["children"] == []


def test_hierarchy_stale_true_when_leaf_parent_name_differs_from_manifest():
    menu_config = {
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
                                "path": "/apps/kuaizhizao/finance-management/receivables",
                            },
                        ],
                    },
                ],
            },
        ],
    }
    finance = SimpleNamespace(
        id=1,
        name="app.kuaicaiwu.menu.finance-management",
        path=None,
        parent_id=10,
        application_uuid="app-uuid",
    )
    leaf = SimpleNamespace(
        id=2,
        name="app.kuaicaiwu.menu.finance-management.receivables",
        path="/apps/kuaizhizao/finance-management/receivables",
        parent_id=1,
        application_uuid="app-uuid",
    )

    async def _run() -> bool:
        with patch(
            "core.models.menu.Menu.filter",
            new_callable=AsyncMock,
            return_value=[finance, leaf],
        ):
            return await ApplicationService._application_menu_hierarchy_stale(
                tenant_id=1,
                application_uuid="app-uuid",
                app_code="kuaicaiwu",
                manifest_menu_config=menu_config,
            )

    assert __import__("asyncio").run(_run()) is True


def test_pick_manifest_folder_parent_raises_when_duplicate_folders_unresolvable():
    leaf = SimpleNamespace(id=10, parent_id=999)
    folder_a = SimpleNamespace(id=20, parent_id=100, name="app.kuaicaiwu.menu.group.finance-receipts")
    folder_b = SimpleNamespace(id=21, parent_id=200, name="app.kuaicaiwu.menu.group.finance-receipts")
    with pytest.raises(ValidationError):
        MenuService._pick_manifest_folder_parent([folder_a, folder_b], leaf)


@pytest.mark.asyncio
async def test_realign_raises_when_group_folder_missing_after_manifest_declares_group():
    menu_config = {
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
                                "path": "/apps/kuaizhizao/finance-management/receivables",
                            },
                        ],
                    },
                ],
            },
        ],
    }
    finance = SimpleNamespace(
        id=1,
        name="app.kuaicaiwu.menu.finance-management",
        path=None,
        parent_id=10,
        application_uuid="app-uuid",
        meta={},
        is_active=True,
    )
    leaf = SimpleNamespace(
        id=2,
        name="app.kuaicaiwu.menu.finance-management.receivables",
        path="/apps/kuaizhizao/finance-management/receivables",
        parent_id=1,
        application_uuid="app-uuid",
        meta={},
        is_active=True,
    )

    with patch("core.models.menu.Menu.filter") as menu_filter:
        qs = MagicMock()
        qs.all = AsyncMock(return_value=[finance, leaf])
        menu_filter.return_value = qs
        with pytest.raises(ValidationError, match="缺少对应无 path 分组行"):
            await MenuService._realign_application_menu_leaf_parents(
                tenant_id=1,
                application_uuid="app-uuid",
                menu_config=menu_config,
            )


@pytest.mark.asyncio
async def test_ensure_then_realign_writes_leaf_parent_to_group_not_finance_folder():
    menu_config = {
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
                                "path": "/apps/kuaizhizao/finance-management/receivables",
                            },
                        ],
                    },
                ],
            },
        ],
    }
    app_root = SimpleNamespace(
        id=10,
        name="app.kuaicaiwu.name",
        path="/apps/kuaicaiwu",
        parent_id=None,
        application_uuid="app-uuid",
        meta=None,
        is_active=True,
        icon=None,
        component=None,
        is_external=False,
        external_url=None,
    )
    finance = SimpleNamespace(
        id=1,
        name="app.kuaicaiwu.menu.finance-management",
        path=None,
        parent_id=10,
        application_uuid="app-uuid",
        meta=None,
        is_active=True,
        icon=None,
        component=None,
        is_external=False,
        external_url=None,
    )
    finance.save = AsyncMock()
    leaf = SimpleNamespace(
        id=2,
        name="app.kuaicaiwu.menu.finance-management.receivables",
        path="/apps/kuaizhizao/finance-management/receivables",
        parent_id=1,
        application_uuid="app-uuid",
        meta={},
        is_active=True,
    )
    created_groups: list[SimpleNamespace] = []

    async def fake_create(**kwargs):
        row = SimpleNamespace(
            id=100 + len(created_groups),
            uuid=f"group-{len(created_groups)}",
            parent_id=kwargs.get("parent_id"),
            name=kwargs.get("name"),
            path=None,
            meta=kwargs.get("meta"),
            is_active=kwargs.get("is_active", True),
            icon=kwargs.get("icon"),
            component=kwargs.get("component"),
            is_external=kwargs.get("is_external", False),
            external_url=kwargs.get("external_url"),
            application_uuid=kwargs.get("application_uuid"),
        )
        created_groups.append(row)
        return row

    saved_parent_ids: list[int] = []

    async def fake_save(update_fields=None):
        saved_parent_ids.append(leaf.parent_id)

    leaf.save = fake_save  # type: ignore[method-assign]

    rows = [app_root, finance, leaf]

    with patch("core.models.menu.Menu.filter") as menu_filter, patch(
        "core.models.menu.Menu.create", side_effect=fake_create
    ):
        qs = MagicMock()
        qs.all = AsyncMock(return_value=rows)
        menu_filter.return_value = qs

        created = await MenuService._ensure_manifest_intermediate_folders(
            tenant_id=1,
            application_uuid="app-uuid",
            menu_config=menu_config,
        )
        assert created == 1  # 仅补建 manifest 分组行；财务管理文件夹已存在
        group = next(r for r in created_groups if ".menu.group." in (r.name or ""))
        assert group.parent_id == finance.id
        assert (group.meta or {}).get("type") == "group"

        rows.extend(created_groups)
        qs.all = AsyncMock(return_value=rows)

        fixed = await MenuService._realign_application_menu_leaf_parents(
            tenant_id=1,
            application_uuid="app-uuid",
            menu_config=menu_config,
        )
        assert fixed == 1
        assert leaf.parent_id == group.id
        assert saved_parent_ids == [group.id]
