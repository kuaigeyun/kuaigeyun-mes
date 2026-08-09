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
    "CustomerProvided": ISSUE_METHOD_PICK,
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


# 下达缺料/生产领料：不校验厂内实物库存（服务无库存；委外收货前由供应商供给；虚拟不占料）
NON_INVENTORY_KITTING_SOURCE_TYPES = frozenset({"Service", "Outsource", "Phantom"})
# 齐套率分母：服务/虚拟不计；委外子件须按收货/库存计入（未完成不得 100%）
NON_KITTING_RATE_SOURCE_TYPES = frozenset({"Service", "Phantom"})


def is_kitting_inventory_material(
    bom_issue_method: Optional[str],
    source_type: Optional[str] = None,
) -> bool:
    """下达缺料：需校验厂内实物库存的 BOM 行（排除服务、委外、虚拟件及发料 none）。"""
    st = (source_type or "").strip()
    if st in NON_INVENTORY_KITTING_SOURCE_TYPES:
        return False
    return resolve_issue_method(bom_issue_method, source_type) != ISSUE_METHOD_NONE


def is_kitting_rate_material(
    bom_issue_method: Optional[str],
    source_type: Optional[str] = None,
) -> bool:
    """工单齐套率：计入库存件与委外子件；排除服务、虚拟件及发料 none。"""
    st = (source_type or "").strip()
    if st in NON_KITTING_RATE_SOURCE_TYPES:
        return False
    if st == "Outsource":
        return True
    return is_kitting_inventory_material(bom_issue_method, source_type)


def is_batching_material(bom_issue_method: Optional[str], source_type: Optional[str] = None) -> bool:
    """
    线边备料/配料：需从主仓拣到线边的物料。
    含委外子件（收货入主仓/半成品仓后须备到线边才能做成品）；排除服务、虚拟、发料 none。
    """
    st = (source_type or "").strip()
    if st in ("Service", "Phantom"):
        return False
    if st == "Outsource":
        return resolve_issue_method(bom_issue_method, source_type) != ISSUE_METHOD_NONE
    if not is_kitting_inventory_material(bom_issue_method, source_type):
        return False
    im = resolve_issue_method(bom_issue_method, source_type)
    return im in (ISSUE_METHOD_PICK, ISSUE_METHOD_BACKFLUSH)


def is_pick_list_material(bom_issue_method: Optional[str], source_type: Optional[str] = None) -> bool:
    """
    生产领料单明细：事前领料 (pick)。
    含委外子件（收货并备到线边后须正式发料出库）；倒冲由报工扣线边，不进领料单。
    """
    st = (source_type or "").strip()
    st_key = st.lower()
    if st_key in ("service", "phantom"):
        return False
    # 委外：默认 pick，收货入线边后须走正式领料，不得因「非厂内库存来源」被挡掉
    if st_key == "outsource":
        return resolve_issue_method(bom_issue_method, source_type) == ISSUE_METHOD_PICK
    if not is_kitting_inventory_material(bom_issue_method, source_type):
        return False
    return is_pick_material(bom_issue_method, source_type)
