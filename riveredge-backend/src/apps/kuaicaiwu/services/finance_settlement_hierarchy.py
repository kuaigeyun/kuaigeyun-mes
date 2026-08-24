"""
收/付款单挂到应收/应付单之下的层级排序（伙伴对账单、业务单据对账往来缺口共用）。
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Set, Tuple


async def order_lines_by_settlement_hierarchy(
    tenant_id: int,
    lines: List[Dict[str, Any]],
    *,
    parent_doc_types: Set[str],
    child_doc_types: Set[str],
    rel_source: str,
    rel_target: str,
    debit_doc_type: str,
    credit_doc_type: str,
    sort_date_key: str = "sort_date",
    date_fallback_key: str = "date",
) -> List[Dict[str, Any]]:
    """
    将收/付款单挂到对应应收/应付单之下（扁平列表 + tree_level）。
    关联优先 DocumentRelation，其次 SettlementRecord（核销）；
    一笔收/付款只挂到一个父单，避免金额重复。
    """
    if not lines:
        return lines

    parents = [ln for ln in lines if ln.get("doc_type") in parent_doc_types]
    children = [ln for ln in lines if ln.get("doc_type") in child_doc_types]
    others = [
        ln
        for ln in lines
        if ln.get("doc_type") not in parent_doc_types and ln.get("doc_type") not in child_doc_types
    ]
    if not parents or not children:
        for ln in lines:
            ln.setdefault("tree_level", 0)
        return lines

    parent_by_id = {
        int(p["doc_id"]): p for p in parents if p.get("doc_id") is not None
    }
    parent_ids = set(parent_by_id.keys())
    child_ids = [int(c["doc_id"]) for c in children if c.get("doc_id") is not None]
    child_parent: Dict[int, int] = {}

    if child_ids:
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=rel_source,
            target_type=rel_target,
            target_id__in=child_ids,
        ).all()
        for rel in rels:
            if not rel.source_id or not rel.target_id:
                continue
            sid, tid = int(rel.source_id), int(rel.target_id)
            if sid in parent_ids:
                child_parent.setdefault(tid, sid)

    unset_ids = [cid for cid in child_ids if cid not in child_parent]
    if unset_ids:
        from apps.kuaicaiwu.models.settlement import SettlementRecord

        settles = await SettlementRecord.filter(
            tenant_id=tenant_id,
            debit_doc_type=debit_doc_type,
            credit_doc_type=credit_doc_type,
            credit_doc_id__in=unset_ids,
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        by_credit: Dict[int, List[Any]] = defaultdict(list)
        for s in settles:
            if s.debit_doc_id and int(s.debit_doc_id) in parent_ids:
                by_credit[int(s.credit_doc_id)].append(s)
        for cid, lst in by_credit.items():
            best = max(lst, key=lambda x: abs(float(x.amount or 0)))
            child_parent[cid] = int(best.debit_doc_id)

    buckets: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    orphans: List[Dict[str, Any]] = []
    for c in children:
        row = dict(c)
        cid = int(row["doc_id"]) if row.get("doc_id") is not None else None
        pid = child_parent.get(cid) if cid is not None else None
        if pid is not None and pid in parent_by_id:
            parent = parent_by_id[pid]
            row["tree_level"] = 1
            row["parent_doc_id"] = pid
            row["parent_doc_code"] = parent.get("doc_code")
            buckets[pid].append(row)
        else:
            row["tree_level"] = 0
            orphans.append(row)

    def _line_sort_key(ln: Dict[str, Any]) -> Tuple[Any, ...]:
        return (
            ln.get(sort_date_key) or ln.get(date_fallback_key) or "",
            ln.get("doc_type") or "",
            ln.get("doc_id") or 0,
        )

    for pid in buckets:
        buckets[pid].sort(key=_line_sort_key)

    top_items: List[Tuple[str, Dict[str, Any]]] = []
    for p in parents:
        row = dict(p)
        row["tree_level"] = 0
        top_items.append(("parent", row))
    for o in orphans:
        top_items.append(("orphan", o))
    for o in others:
        row = dict(o)
        row.setdefault("tree_level", 0)
        top_items.append(("other", row))

    top_items.sort(
        key=lambda item: (
            item[1].get(sort_date_key) or item[1].get(date_fallback_key) or "",
            0 if item[0] == "parent" else 1,
            item[1].get("doc_type") or "",
            item[1].get("doc_id") or 0,
        )
    )

    result: List[Dict[str, Any]] = []
    for kind, item in top_items:
        result.append(item)
        if kind == "parent":
            pid = item.get("doc_id")
            if pid is not None:
                result.extend(buckets.get(int(pid), []))
    return result
