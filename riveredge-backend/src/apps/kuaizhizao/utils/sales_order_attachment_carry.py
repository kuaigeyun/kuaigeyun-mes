"""
销售订单附件下推采购：从需求计算关联的来源销售订单收集 attachments JSON（引用 core_files UUID）。
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

PREVIEW_ITEM_LIMIT = 8


def _attachment_uid(entry: Any) -> Optional[str]:
    if isinstance(entry, str):
        uid = entry.strip()
        return uid or None
    if isinstance(entry, dict):
        for key in ("uid", "uuid", "file_uuid", "fileUuid"):
            raw = entry.get(key)
            if raw is not None and str(raw).strip():
                return str(raw).strip()
    return None


def normalize_attachment_entry(entry: Any) -> Optional[Dict[str, Any]]:
    """规范为前端 Upload / documentAttachments 使用的 JSON 形态。"""
    if isinstance(entry, str):
        uid = entry.strip()
        if not uid:
            return None
        return {
            "uid": uid,
            "name": "附件",
            "status": "done",
            "url": f"/api/v1/core/files/{uid}/download",
        }
    if isinstance(entry, dict):
        uid = _attachment_uid(entry)
        if not uid:
            return None
        name = str(
            entry.get("name")
            or entry.get("original_name")
            or entry.get("originalName")
            or "附件"
        ).strip() or "附件"
        url = entry.get("url") or f"/api/v1/core/files/{uid}/download"
        return {
            "uid": uid,
            "name": name,
            "status": "done",
            "url": url,
        }
    return None


def merge_attachment_lists(*lists: Iterable[Any]) -> List[Dict[str, Any]]:
    """按 uid 去重合并多组 attachments JSON。"""
    merged: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for raw_list in lists:
        if not raw_list:
            continue
        for entry in raw_list:
            normalized = normalize_attachment_entry(entry)
            if not normalized:
                continue
            uid = str(normalized["uid"])
            if uid in seen:
                continue
            seen.add(uid)
            merged.append(normalized)
    return merged


def _resolve_demand_ids_from_computation(computation: Any) -> List[int]:
    ids: List[int] = []
    seen: set[int] = set()
    demand_ids = getattr(computation, "demand_ids", None)
    if isinstance(demand_ids, list):
        for raw in demand_ids:
            if raw is None:
                continue
            did = int(raw)
            if did not in seen:
                seen.add(did)
                ids.append(did)
    demand_id = getattr(computation, "demand_id", None)
    if demand_id is not None:
        did = int(demand_id)
        if did not in seen:
            ids.insert(0, did)
    return ids


async def _resolve_sales_order_ids_from_demands(
    tenant_id: int,
    demand_ids: Sequence[int],
) -> List[Tuple[int, str]]:
    """返回 (sales_order_id, demand_code_or_empty) 列表，保持 demand 顺序。"""
    if not demand_ids:
        return []

    from apps.kuaizhizao.models.demand import Demand

    demands = await Demand.filter(
        tenant_id=tenant_id,
        id__in=list(demand_ids),
        deleted_at__isnull=True,
    ).all()
    demand_by_id = {int(d.id): d for d in demands}

    result: List[Tuple[int, str]] = []
    seen_so: set[int] = set()
    for did in demand_ids:
        demand = demand_by_id.get(int(did))
        if not demand:
            continue
        dtype = str(getattr(demand, "demand_type", "") or "").strip()
        stype = str(getattr(demand, "source_type", "") or "").strip()
        source_id = getattr(demand, "source_id", None)
        if dtype != "sales_order" or not source_id:
            continue
        if stype and stype != "sales_order":
            continue
        so_id = int(source_id)
        if so_id in seen_so:
            continue
        seen_so.add(so_id)
        label = str(getattr(demand, "source_code", "") or getattr(demand, "demand_code", "") or "").strip()
        result.append((so_id, label))
    return result


async def collect_sales_order_attachments_for_computation(
    tenant_id: int,
    computation_id: int,
) -> List[Dict[str, Any]]:
    """从单张需求计算关联的来源销售订单收集 attachments（uid 去重）。"""
    from apps.kuaizhizao.models.demand_computation import DemandComputation

    computation = await DemandComputation.get_or_none(
        tenant_id=tenant_id,
        id=int(computation_id),
        deleted_at__isnull=True,
    )
    if not computation:
        return []
    return await collect_sales_order_attachments_for_computations(tenant_id, [computation])


async def collect_sales_order_attachments_for_computations(
    tenant_id: int,
    computations: Sequence[Any],
) -> List[Dict[str, Any]]:
    if not computations:
        return []

    from apps.kuaizhizao.models.sales_order import SalesOrder

    demand_ids: List[int] = []
    seen_demand: set[int] = set()
    for computation in computations:
        for did in _resolve_demand_ids_from_computation(computation):
            if did not in seen_demand:
                seen_demand.add(did)
                demand_ids.append(did)

    so_refs = await _resolve_sales_order_ids_from_demands(tenant_id, demand_ids)
    if not so_refs:
        return []

    so_ids = [so_id for so_id, _ in so_refs]
    orders = await SalesOrder.filter(
        tenant_id=tenant_id,
        id__in=so_ids,
        deleted_at__isnull=True,
    ).all()
    order_by_id = {int(o.id): o for o in orders}

    raw_lists: List[List[Any]] = []
    for so_id, _ in so_refs:
        order = order_by_id.get(so_id)
        if not order:
            continue
        attachments = getattr(order, "attachments", None)
        if attachments:
            raw_lists.append(list(attachments))

    return merge_attachment_lists(*raw_lists)


async def summarize_sales_order_attachments_for_computation(
    tenant_id: int,
    computation_id: int,
    preview_limit: int = PREVIEW_ITEM_LIMIT,
) -> Dict[str, Any]:
    """下推预览：返回来源销售订单附件摘要。"""
    from apps.kuaizhizao.models.demand_computation import DemandComputation
    from apps.kuaizhizao.models.sales_order import SalesOrder

    computation = await DemandComputation.get_or_none(
        tenant_id=tenant_id,
        id=int(computation_id),
        deleted_at__isnull=True,
    )
    if not computation:
        return {"available": False, "count": 0, "items": [], "source_order_codes": [], "source_order_count": 0}

    demand_ids = _resolve_demand_ids_from_computation(computation)
    so_refs = await _resolve_sales_order_ids_from_demands(tenant_id, demand_ids)
    if not so_refs:
        return {"available": False, "count": 0, "items": [], "source_order_codes": [], "source_order_count": 0}

    so_ids = [so_id for so_id, _ in so_refs]
    orders = await SalesOrder.filter(
        tenant_id=tenant_id,
        id__in=so_ids,
        deleted_at__isnull=True,
    ).all()
    order_by_id = {int(o.id): o for o in orders}

    source_order_codes: List[str] = []
    for so_id, fallback_code in so_refs:
        order = order_by_id.get(so_id)
        code = (
            str(getattr(order, "order_code", "") or "").strip()
            or fallback_code
            or str(so_id)
        )
        if code and code not in source_order_codes:
            source_order_codes.append(code)

    attachments = await collect_sales_order_attachments_for_computation(tenant_id, computation_id)
    preview_items: List[Dict[str, Any]] = []
    uid_to_source_code: Dict[str, str] = {}
    for so_id, fallback_code in so_refs:
        order = order_by_id.get(so_id)
        if not order or not getattr(order, "attachments", None):
            continue
        code = str(getattr(order, "order_code", "") or fallback_code or "").strip()
        for entry in order.attachments:
            uid = _attachment_uid(entry)
            if uid and uid not in uid_to_source_code and code:
                uid_to_source_code[uid] = code

    for att in attachments:
        uid = str(att.get("uid") or "")
        preview_items.append(
            {
                "uid": uid,
                "name": att.get("name") or "附件",
                "source_order_code": uid_to_source_code.get(uid),
            }
        )

    return {
        "available": len(attachments) > 0,
        "count": len(attachments),
        "items": preview_items[: max(0, int(preview_limit))],
        "source_order_codes": source_order_codes,
        "source_order_count": len(source_order_codes),
    }


async def resolve_carried_sales_order_attachments(
    tenant_id: int,
    computation_id: Optional[int],
    computation_ids: Optional[Sequence[int]],
    include: bool,
) -> Optional[List[Dict[str, Any]]]:
    """下推写入前：include=False 返回 None；True 时收集 attachments 或 None（空列表视为不写）。"""
    if not include:
        return None

    from apps.kuaizhizao.models.demand_computation import DemandComputation

    ids: List[int] = []
    if computation_id is not None:
        ids.append(int(computation_id))
    if computation_ids:
        for raw in computation_ids:
            if raw is None:
                continue
            cid = int(raw)
            if cid not in ids:
                ids.append(cid)
    if not ids:
        return None

    computations = await DemandComputation.filter(
        tenant_id=tenant_id,
        id__in=ids,
        deleted_at__isnull=True,
    ).all()
    if not computations:
        return None

    merged = await collect_sales_order_attachments_for_computations(tenant_id, computations)
    return merged if merged else None
