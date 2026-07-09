"""
需求行 BOM 生产树：供 MRP 存储与工单组下推使用。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaizhizao.utils.bom_helper import (
    get_bom_items_by_material_id,
    bom_line_required_quantity,
    bom_item_base_quantity,
)
from apps.kuaizhizao.utils.material_source_helper import (
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_CONFIGURE,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_PHANTOM,
    get_material_source_type,
)
from apps.master_data.models.material import Material


SUPPLY_MODE_STOCKED = "stocked"
SUPPLY_MODE_DIRECT = "direct"

_WO_SOURCE_TYPES = frozenset(
    {SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE}
)


def resolve_supply_mode(
    material: Material,
    *,
    bom_issue_method: Optional[str] = None,
) -> str:
    """
    解析半成品供应模式：stocked=入库领料，direct=直接供给上级工单。

    优先级：物料 source_config.supply_mode > BOM 行 issue_method(backflush→direct) > 默认 stocked。
    """
    cfg = material.source_config or {}
    inner = cfg.get("source_config") if isinstance(cfg.get("source_config"), dict) else cfg
    explicit = (inner or {}).get("supply_mode") or cfg.get("supply_mode")
    if explicit in (SUPPLY_MODE_STOCKED, SUPPLY_MODE_DIRECT):
        return explicit
    if bom_issue_method == "backflush":
        return SUPPLY_MODE_DIRECT
    return SUPPLY_MODE_STOCKED


async def build_production_tree_for_demand_item(
    tenant_id: int,
    demand_item_id: int,
    material_id: int,
    required_quantity: float,
    *,
    material_code: str,
    material_name: str,
    source_type: Optional[str],
    unit: Optional[str],
    bom_version: Optional[str] = None,
    use_default_bom: bool = False,
    material_bom_versions: Optional[Dict[int, str]] = None,
    variant_attributes: Optional[Dict[str, Any]] = None,
    configurable_selections: Optional[Dict[str, int]] = None,
    bom_max_level: int = 10,
) -> Dict[str, Any]:
    """为单条需求行构建生产树（仅含需下推工单的节点）。"""
    st = source_type or await get_material_source_type(tenant_id, material_id)
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    root: Dict[str, Any] = {
        "demand_item_id": demand_item_id,
        "material_id": material_id,
        "material_code": material_code,
        "material_name": material_name,
        "source_type": st,
        "required_quantity": float(required_quantity or 0),
        "unit": unit,
        "bom_level": 0,
        "parent_material_id": None,
        "supply_mode": resolve_supply_mode(material) if material else SUPPLY_MODE_STOCKED,
        "children": [],
    }

    top_version = bom_version
    top_use_default = use_default_bom
    if material_bom_versions:
        v = material_bom_versions.get(material_id) or material_bom_versions.get(str(material_id))
        if v:
            top_version = v
            top_use_default = False

    if st in _WO_SOURCE_TYPES or st in (SOURCE_TYPE_PHANTOM, SOURCE_TYPE_CONFIGURE):
        root["children"] = await _walk_bom_children(
            tenant_id=tenant_id,
            parent_material_id=material_id,
            required_quantity=float(required_quantity or 0),
            bom_level=0,
            bom_version=top_version,
            use_default_bom=top_use_default,
            material_bom_versions=material_bom_versions,
            bom_max_level=bom_max_level,
        )
    return root


async def _walk_bom_children(
    tenant_id: int,
    parent_material_id: int,
    required_quantity: float,
    bom_level: int,
    *,
    bom_version: Optional[str],
    use_default_bom: bool,
    material_bom_versions: Optional[Dict[int, str]],
    bom_max_level: int,
) -> List[Dict[str, Any]]:
    if bom_level >= bom_max_level or required_quantity <= 0:
        return []

    bom_items = await get_bom_items_by_material_id(
        tenant_id=tenant_id,
        material_id=parent_material_id,
        only_approved=True,
        version=bom_version,
        use_default=use_default_bom,
    )
    if not bom_items:
        return []

    nodes: List[Dict[str, Any]] = []
    for bom_item in bom_items:
        component = await bom_item.component
        if not component:
            continue
        qty = bom_line_required_quantity(
            bom_item.quantity or Decimal("0"),
            bom_item_base_quantity(bom_item),
            required_quantity,
            bom_item.waste_rate or Decimal("0"),
        )
        if qty <= 0:
            continue

        st = component.source_type or await get_material_source_type(tenant_id, component.id)
        child_version = bom_version
        child_use_default = use_default_bom
        if material_bom_versions:
            v = material_bom_versions.get(component.id) or material_bom_versions.get(str(component.id))
            if v:
                child_version = v
                child_use_default = False

        if st == SOURCE_TYPE_PHANTOM:
            sub = await _walk_bom_children(
                tenant_id=tenant_id,
                parent_material_id=component.id,
                required_quantity=qty,
                bom_level=bom_level + 1,
                bom_version=child_version,
                use_default_bom=child_use_default,
                material_bom_versions=material_bom_versions,
                bom_max_level=bom_max_level,
            )
            for child in sub:
                child["parent_material_id"] = parent_material_id
            nodes.extend(sub)
            continue

        if st == SOURCE_TYPE_BUY:
            continue

        if st not in _WO_SOURCE_TYPES:
            continue

        issue_method = getattr(bom_item, "issue_method", None) or "pick"
        node: Dict[str, Any] = {
            "material_id": component.id,
            "material_code": component.main_code or component.code,
            "material_name": component.name,
            "source_type": st,
            "required_quantity": qty,
            "unit": bom_item.unit or component.base_unit,
            "bom_level": bom_level + 1,
            "parent_material_id": parent_material_id,
            "supply_mode": resolve_supply_mode(component, bom_issue_method=issue_method),
            "children": [],
        }
        if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE):
            node["children"] = await _walk_bom_children(
                tenant_id=tenant_id,
                parent_material_id=component.id,
                required_quantity=qty,
                bom_level=bom_level + 1,
                bom_version=child_version,
                use_default_bom=child_use_default,
                material_bom_versions=material_bom_versions,
                bom_max_level=bom_max_level,
            )
        nodes.append(node)
    return nodes


def flatten_production_tree(tree: Dict[str, Any]) -> List[Dict[str, Any]]:
    """深度优先展开，根节点在前（便于先创建上级工单）。"""
    result: List[Dict[str, Any]] = []

    def walk(node: Dict[str, Any]) -> None:
        result.append(node)
        for child in node.get("children") or []:
            walk(child)

    walk(tree)
    return result


def tree_has_direct_supply(tree: Dict[str, Any]) -> bool:
    for node in flatten_production_tree(tree):
        if node.get("supply_mode") == SUPPLY_MODE_DIRECT and int(node.get("bom_level") or 0) > 0:
            return True
    return False


def allocate_suggested_quantity(
    node_gross: float,
    total_gross: float,
    total_suggested: float,
) -> float:
    """按需求行内毛需求占比分配建议工单量。"""
    if total_suggested <= 0 or node_gross <= 0:
        return 0.0
    if total_gross <= 0:
        return float(total_suggested)
    return float(total_suggested) * (node_gross / total_gross)


def quantize_qty(value: float) -> Decimal:
    return Decimal(str(round(value, 2)))
