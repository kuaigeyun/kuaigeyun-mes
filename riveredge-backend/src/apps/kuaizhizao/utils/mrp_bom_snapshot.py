"""
MRP 下推工单时的 BOM 版本快照（与需求计算展开参数一致）。
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Set

from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.utils.bom_helper import get_bom_by_material_id


def normalize_material_bom_versions(raw: Any) -> Dict[str, str]:
    if not raw or not isinstance(raw, dict):
        return {}
    out: Dict[str, str] = {}
    for k, v in raw.items():
        if v is None:
            continue
        s = str(v).strip()
        if not s:
            continue
        out[str(k)] = s
    return out


async def mrp_seed_material_ids(tenant_id: int, computation: DemandComputation) -> Set[int]:
    from apps.kuaizhizao.models.demand_item import DemandItem

    demand_id_list = computation.demand_ids if computation.demand_ids else [computation.demand_id]
    seed_ids: Set[int] = set()
    for demand_id in demand_id_list:
        if not demand_id:
            continue
        rows = await DemandItem.filter(tenant_id=tenant_id, demand_id=demand_id).values_list(
            "material_id", flat=True
        )
        seed_ids.update(int(x) for x in rows if x)
    return seed_ids


def resolve_mrp_version_for_material(
    computation_params: Optional[Dict[str, Any]],
    material_id: int,
    *,
    seed_material_ids: Optional[Set[int]] = None,
) -> tuple[Optional[str], bool]:
    """
    与 MRP 展开一致：返回 (指定版本, use_default_bom)。
    无 MRP BOM 参数时返回 (None, True) 表示走默认/最新（非 MRP 下推工单）。
    """
    params = computation_params or {}
    global_v = params.get("bom_version")
    mbv = normalize_material_bom_versions(params.get("material_bom_versions"))
    if not global_v and not mbv:
        return None, True

    per = mbv.get(str(material_id))
    if per:
        return per, False
    seeds = seed_material_ids or set()
    if global_v and material_id in seeds:
        return str(global_v).strip() or None, False
    if mbv or global_v:
        return None, True
    return None, True


def computation_params_to_bom_params(
    computation_params: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    params = computation_params or {}
    global_v = params.get("bom_version")
    mbv = normalize_material_bom_versions(params.get("material_bom_versions"))
    if not global_v and not mbv:
        return {}
    out: Dict[str, Any] = {}
    if global_v:
        out["bom_version"] = str(global_v).strip()
    if mbv:
        out["material_bom_versions"] = mbv
    return out


async def build_bom_snapshot_from_params(
    tenant_id: int,
    bom_params: Optional[Dict[str, Any]],
    material_id: int,
    *,
    seed_material_ids: Optional[Set[int]] = None,
) -> Dict[str, Any]:
    """从 bom_version / material_bom_versions 解析工单 BOM 快照（MRP 或销售直推）。"""
    params = bom_params or {}
    global_v = params.get("bom_version")
    mbv = normalize_material_bom_versions(params.get("material_bom_versions"))
    if not global_v and not mbv:
        return {}

    version, use_default = resolve_mrp_version_for_material(
        params, material_id, seed_material_ids=seed_material_ids
    )

    bom = await get_bom_by_material_id(
        tenant_id=tenant_id,
        material_id=material_id,
        only_approved=True,
        version=version,
        use_default=use_default if not version else False,
    )
    snapshot: Dict[str, Any] = {}
    if global_v:
        snapshot["bom_version"] = str(global_v).strip()
    if mbv:
        snapshot["material_bom_versions"] = mbv
    if bom:
        snapshot["bom_id"] = int(bom.id)
        snapshot["product_bom_version"] = str(bom.version or "")
    return snapshot


async def build_mrp_bom_snapshot_for_material(
    tenant_id: int,
    computation: DemandComputation,
    material_id: int,
    *,
    seed_material_ids: Optional[Set[int]] = None,
) -> Dict[str, Any]:
    """
    下推工单时写入的快照：global bom_version、按物料版本表、以及本成品解析后的 bom_id。
    """
    bom_params = computation_params_to_bom_params(computation.computation_params)
    if not bom_params:
        return {}

    if seed_material_ids is None:
        seed_material_ids = await mrp_seed_material_ids(tenant_id, computation)

    return await build_bom_snapshot_from_params(
        tenant_id,
        bom_params,
        material_id,
        seed_material_ids=seed_material_ids,
    )


def bom_expand_kwargs_from_work_order(work_order: WorkOrder) -> Dict[str, Any]:
    """供 calculate_material_requirements_from_bom / expand_bom 使用的参数；无快照则返回空 dict。"""
    global_v = getattr(work_order, "bom_version", None)
    mbv_raw = getattr(work_order, "material_bom_versions", None)
    mbv = normalize_material_bom_versions(mbv_raw)
    bom_id = getattr(work_order, "bom_id", None)
    if not global_v and not mbv and not bom_id:
        return {}

    kwargs: Dict[str, Any] = {}
    if global_v:
        kwargs["bom_version"] = str(global_v).strip()
    if mbv:
        kwargs["material_bom_versions"] = mbv
    if global_v or mbv:
        kwargs["use_default_bom"] = False
    elif bom_id:
        kwargs["use_default_bom"] = False
    return kwargs


async def resolve_mrp_item_bom_fields(
    tenant_id: int,
    computation: DemandComputation,
    material_id: int,
    *,
    seed_material_ids: Optional[Set[int]] = None,
) -> tuple[Optional[int], Optional[str]]:
    snap = await build_mrp_bom_snapshot_for_material(
        tenant_id, computation, material_id, seed_material_ids=seed_material_ids
    )
    if not snap:
        return None, None
    return snap.get("bom_id"), snap.get("product_bom_version")
