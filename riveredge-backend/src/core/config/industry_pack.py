"""
行业包容器应用（唯一真源）。

- 侧栏仅展示一个「行业包」应用根
- 各行业模块名称作为行业包一级菜单，模块内原菜单作为二级及以下
- 与 industry_app_catalog 中 ALL_INDUSTRY_APP_CODES 区分：后者为可安装模块，不含 industry-pack
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

INDUSTRY_PACK_APP_CODE = "industry-pack"
INDUSTRY_PACK_SORT_ORDER = 290


def resolve_industry_pack_navigation_visible(*, is_installed: bool, active_module_count: int) -> bool:
    """侧栏是否展示行业包容器：已安装且至少有一个已启用的行业模块。"""
    return bool(is_installed) and active_module_count > 0


def is_industry_pack_shell_code(app_code: str | None) -> bool:
    return str(app_code or "") == INDUSTRY_PACK_APP_CODE


def is_industry_module_app_code(app_code: str | None) -> bool:
    from core.config.industry_app_catalog import is_industry_app_code

    code = str(app_code or "")
    if not code or is_industry_pack_shell_code(code):
        return False
    return is_industry_app_code(code)


def should_hide_from_application_center(app_code: str | None) -> bool:
    return is_industry_pack_shell_code(app_code)


def _app_menu_title_key(app_code: str) -> str:
    return f"app.{app_code}.name"


def _normalize_pack_menu_node(raw: Dict[str, Any]) -> Dict[str, Any]:
    """将 manifest 菜单节点规范为行业包同步结构（支持递归 children）。"""
    node: Dict[str, Any] = {}
    title = raw.get("title") or raw.get("name")
    if title:
        node["title"] = title
    icon = raw.get("icon")
    if icon:
        node["icon"] = icon
    path = str(raw.get("path") or "").strip()
    if path:
        node["path"] = path
    permission = raw.get("permission")
    if permission:
        node["permission"] = permission
    if raw.get("sort_order") is not None:
        node["sort_order"] = int(raw.get("sort_order"))
    children = raw.get("children") or []
    if isinstance(children, list) and children:
        normalized_children = [
            _normalize_pack_menu_node(child)
            for child in children
            if isinstance(child, dict)
        ]
        normalized_children.sort(
            key=lambda item: (int(item.get("sort_order") or 999), str(item.get("title") or ""))
        )
        node["children"] = normalized_children
    return node


def _collect_module_menu_children(manifest: Dict[str, Any]) -> List[Dict[str, Any]]:
    """收集行业模块在行业包应用节点下的子菜单（原应用一级菜单起）。"""
    code = str(manifest.get("code") or "").strip()
    raw = manifest.get("industry_pack_menu")
    if isinstance(raw, dict):
        children_raw = raw.get("children")
        if isinstance(children_raw, list) and children_raw:
            return [
                _normalize_pack_menu_node(child)
                for child in children_raw
                if isinstance(child, dict)
            ]
        # 兼容旧版：industry_pack_menu 直接声明叶子页面
        if str(raw.get("path") or "").strip():
            return [_normalize_pack_menu_node(raw)]

    menu_config = manifest.get("menu_config")
    if isinstance(menu_config, dict):
        config_children = menu_config.get("children")
        if isinstance(config_children, list) and config_children:
            return [
                _normalize_pack_menu_node(child)
                for child in config_children
                if isinstance(child, dict)
            ]
        if str(menu_config.get("path") or "").strip():
            return [_normalize_pack_menu_node(menu_config)]

    route_path = str(manifest.get("route_path") or "").strip()
    if route_path:
        return [
            {
                "title": _app_menu_title_key(code),
                "path": route_path,
                "permission": f"{code}:entry:read",
            }
        ]
    return []


def manifest_to_industry_pack_menu_item(manifest: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    从 manifest 解析行业模块在行业包下的菜单节点。

    结构：行业包 → 应用名（一级）→ 原应用菜单（二级及以下）
    """
    code = str(manifest.get("code") or "").strip()
    if not code:
        return None

    children = _collect_module_menu_children(manifest)
    if not children:
        return None

    route_path = str(manifest.get("route_path") or "").strip()
    return {
        "title": _app_menu_title_key(code),
        "icon": manifest.get("icon"),
        "path": route_path or None,
        "permission": f"{code}:entry:read",
        "sort_order": int(manifest.get("sort_order") or 999),
        "children": children,
    }
