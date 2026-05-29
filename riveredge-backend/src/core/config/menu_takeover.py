"""
应用菜单接管配置

当 consumer 应用启用时，source 应用中匹配的菜单在侧栏隐藏，由 consumer  manifest 挂载同路径入口。
页面与 API 仍归属 source 应用（如 master-data），仅导航归属切换。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple


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
    "path_matches_takeover_prefix",
]
