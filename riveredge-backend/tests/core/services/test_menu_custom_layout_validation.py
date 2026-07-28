"""自组菜单布局校验单元测试。"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from core.schemas.menu import CustomMenuLayoutNode
from core.services.system.menu_service import MenuService
from infra.exceptions.exceptions import ValidationError


def _mock_source_lookup() -> dict:
    source_tree = MenuService._collect_menu_tree_lookup([])  # noqa: SLF001
    # 直接注入最小源菜单映射；仅校验 UUID 存在性与 path 一致性
    source_tree["menu-1"] = type("Node", (), {"path": "/apps/a/b"})()
    source_tree["menu-2"] = type("Node", (), {"path": "/apps/a/c"})()
    return source_tree


def test_custom_layout_duplicate_node_id_rejected():
    nodes = [
        CustomMenuLayoutNode(
            id="grp-1",
            type="custom_group",
            title="分组A",
            children=[
                CustomMenuLayoutNode(id="dup", type="menu_ref", menu_uuid="menu-1"),
            ],
        ),
        CustomMenuLayoutNode(
            id="grp-2",
            type="custom_group",
            title="分组B",
            children=[
                CustomMenuLayoutNode(id="dup", type="menu_ref", menu_uuid="menu-2"),
            ],
        ),
    ]
    with pytest.raises(ValidationError):
        asyncio.run(
            MenuService._validate_custom_menu_layout_nodes(  # noqa: SLF001
                1, nodes, _mock_source_lookup()
            )
        )


def test_custom_layout_missing_menu_ref_rejected():
    nodes = [
        CustomMenuLayoutNode(
            id="grp-1",
            type="app_group",
            title="应用组",
            children=[
                CustomMenuLayoutNode(id="ref-1", type="menu_ref", menu_uuid="menu-x"),
            ],
        ),
    ]
    with patch.object(
        MenuService,
        "_resolve_active_menu_ref_paths",
        new=AsyncMock(return_value={}),
    ):
        with pytest.raises(ValidationError):
            asyncio.run(
                MenuService._validate_custom_menu_layout_nodes(  # noqa: SLF001
                    1, nodes, _mock_source_lookup()
                )
            )


def test_custom_layout_path_mismatch_rejected():
    nodes = [
        CustomMenuLayoutNode(
            id="grp-1",
            type="app_group",
            title="应用组",
            children=[
                CustomMenuLayoutNode(
                    id="ref-1",
                    type="menu_ref",
                    menu_uuid="menu-1",
                    menu_path="/apps/a/wrong",
                ),
            ],
        ),
    ]
    with pytest.raises(ValidationError):
        asyncio.run(
            MenuService._validate_custom_menu_layout_nodes(  # noqa: SLF001
                1, nodes, _mock_source_lookup()
            )
        )


def test_custom_layout_db_fallback_path_accepted():
    """树中不可达但库内仍启用的菜单，应能通过校验。"""
    nodes = [
        CustomMenuLayoutNode(
            id="grp-1",
            type="app_group",
            title="应用组",
            children=[
                CustomMenuLayoutNode(
                    id="ref-1",
                    type="menu_ref",
                    menu_uuid="menu-orphan",
                    menu_path="/apps/a/orphan",
                ),
            ],
        ),
    ]
    with patch.object(
        MenuService,
        "_resolve_active_menu_ref_paths",
        new=AsyncMock(return_value={"menu-orphan": "/apps/a/orphan"}),
    ):
        asyncio.run(
            MenuService._validate_custom_menu_layout_nodes(  # noqa: SLF001
                1, nodes, _mock_source_lookup()
            )
        )
