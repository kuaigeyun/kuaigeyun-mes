"""
应用菜单接管配置

当 consumer 应用启用时，source 应用中匹配的菜单在侧栏隐藏，由 consumer  manifest 挂载同路径入口。
页面与 API 仍归属 source 应用（如 master-data），仅导航归属切换。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Tuple


@dataclass(frozen=True)
class MenuTakeoverRule:
    consumer_app_code: str
    source_app_code: str
    path_prefixes: Tuple[str, ...]


MENU_TAKEOVER_RULES: Dict[str, MenuTakeoverRule] = {
    "kuaiplm": MenuTakeoverRule(
        consumer_app_code="kuaiplm",
        source_app_code="master-data",
        path_prefixes=("/apps/master-data/process",),
    ),
}

META_SUPPRESSED_BY_TAKEOVER = "suppressed_by_takeover"
META_DISPLAY_NAME = "display_name"
RUNTIME_META_KEYS = (META_SUPPRESSED_BY_TAKEOVER, META_DISPLAY_NAME)
MENU_DISPLAY_NAME_MAX_LEN = 100


def merge_menu_meta_for_sync(
    existing_meta: Dict[str, Any] | None,
    manifest_meta: Dict[str, Any] | None,
) -> Dict[str, Any] | None:
    """
    菜单同步时合并 manifest meta，保留运行时写入的键。

    运行时键（接管标记、侧栏展示名覆盖）不以 manifest 为准，避免同步冲掉租户自定义。
    manifest 未声明 meta 时不覆盖已有 meta。
    """
    if manifest_meta is None:
        return existing_meta
    merged: Dict[str, Any] = {**(existing_meta or {}), **manifest_meta}
    for key in RUNTIME_META_KEYS:
        merged.pop(key, None)
        if existing_meta and key in existing_meta:
            merged[key] = existing_meta[key]
    return merged or None


def path_matches_takeover_prefix(path: str | None, rule: MenuTakeoverRule) -> bool:
    if not path:
        return False
    normalized = path.strip()
    return any(
        normalized == prefix or normalized.startswith(f"{prefix}/")
        for prefix in rule.path_prefixes
    )


__all__ = [
    "MenuTakeoverRule",
    "MENU_TAKEOVER_RULES",
    "META_SUPPRESSED_BY_TAKEOVER",
    "META_DISPLAY_NAME",
    "RUNTIME_META_KEYS",
    "MENU_DISPLAY_NAME_MAX_LEN",
    "merge_menu_meta_for_sync",
    "path_matches_takeover_prefix",
]
