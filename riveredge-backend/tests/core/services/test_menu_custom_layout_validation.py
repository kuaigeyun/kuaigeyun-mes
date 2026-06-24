"""自组菜单布局校验单元测试。"""

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
        MenuService._validate_custom_menu_layout_nodes(nodes, _mock_source_lookup())  # noqa: SLF001


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
    with pytest.raises(ValidationError):
        MenuService._validate_custom_menu_layout_nodes(nodes, _mock_source_lookup())  # noqa: SLF001


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
        MenuService._validate_custom_menu_layout_nodes(nodes, _mock_source_lookup())  # noqa: SLF001

