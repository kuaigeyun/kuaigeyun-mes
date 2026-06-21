"""BOM 发料方式解析：pick / backflush / none。"""

from __future__ import annotations

from typing import Optional

ISSUE_METHOD_PICK = "pick"
ISSUE_METHOD_BACKFLUSH = "backflush"
ISSUE_METHOD_NONE = "none"

VALID_ISSUE_METHODS = (ISSUE_METHOD_PICK, ISSUE_METHOD_BACKFLUSH, ISSUE_METHOD_NONE)

_SOURCE_DEFAULTS = {
    "Phantom": ISSUE_METHOD_NONE,
    "Service": ISSUE_METHOD_NONE,
    "Buy": ISSUE_METHOD_BACKFLUSH,
    "Make": ISSUE_METHOD_PICK,
    "Outsource": ISSUE_METHOD_PICK,
    "Configure": ISSUE_METHOD_PICK,
}


def resolve_issue_method(
    bom_issue_method: Optional[str],
    source_type: Optional[str] = None,
) -> str:
    explicit = (bom_issue_method or "").strip().lower()
    if explicit in VALID_ISSUE_METHODS:
        return explicit
    st = (source_type or "").strip()
    return _SOURCE_DEFAULTS.get(st, ISSUE_METHOD_PICK)


def is_pick_material(bom_issue_method: Optional[str], source_type: Optional[str] = None) -> bool:
    return resolve_issue_method(bom_issue_method, source_type) == ISSUE_METHOD_PICK


def is_backflush_material(bom_issue_method: Optional[str], source_type: Optional[str] = None) -> bool:
    return resolve_issue_method(bom_issue_method, source_type) == ISSUE_METHOD_BACKFLUSH


NON_INVENTORY_KITTING_SOURCE_TYPES = frozenset({"Service", "Outsource", "Phantom"})


def is_kitting_inventory_material(
    bom_issue_method: Optional[str],
    source_type: Optional[str] = None,
) -> bool:
    """齐套率/库位分析：需校验实物库存的 BOM 行（排除服务、委外、虚拟件及发料 none）。"""
    st = (source_type or "").strip()
    if st in NON_INVENTORY_KITTING_SOURCE_TYPES:
        return False
    return resolve_issue_method(bom_issue_method, source_type) != ISSUE_METHOD_NONE


def is_batching_material(bom_issue_method: Optional[str], source_type: Optional[str] = None) -> bool:
    """需经配料中心从主仓拣选并送至线边仓的物料（pick + backflush，排除无库存来源）。"""
    if not is_kitting_inventory_material(bom_issue_method, source_type):
        return False
    im = resolve_issue_method(bom_issue_method, source_type)
    return im in (ISSUE_METHOD_PICK, ISSUE_METHOD_BACKFLUSH)
