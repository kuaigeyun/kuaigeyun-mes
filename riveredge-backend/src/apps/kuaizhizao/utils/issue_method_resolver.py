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


def is_batching_material(bom_issue_method: Optional[str], source_type: Optional[str] = None) -> bool:
    """需经配料中心从主仓拣选并送至线边仓的物料（pick + backflush，排除 none/虚拟件）。"""
    im = resolve_issue_method(bom_issue_method, source_type)
    return im in (ISSUE_METHOD_PICK, ISSUE_METHOD_BACKFLUSH)
