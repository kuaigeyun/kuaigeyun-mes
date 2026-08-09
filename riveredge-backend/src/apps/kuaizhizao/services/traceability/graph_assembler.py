"""
追溯图谱组装：由 TraceEvent 与 MaterialBinding 链构建 nodes/edges
"""

from typing import Dict, List, Set, Tuple

from apps.kuaizhizao.models.material_binding import MaterialBinding
from apps.kuaizhizao.schemas.traceability_schemas import (
    TraceDirection,
    TraceEdgeResponse,
    TraceEventResponse,
    TraceIdentifierType,
    TraceNodeResponse,
)
from apps.kuaizhizao.services.traceability.identifier_resolver import ResolvedTraceAnchor


_DOC_LABELS = {
    "serial": "序列号",
    "batch": "批号",
    "work_order": "工单",
    "purchase_receipt": "采购入库",
    "customer_material_registration": "代工来料",
    "finished_goods_receipt": "成品入库",
    "semi_finished_goods_receipt": "半成品入库",
    "sales_delivery": "销售出库",
    "sales_return": "销售退货",
    "incoming_inspection": "来料检验",
    "process_inspection": "过程检验",
    "finished_goods_inspection": "成品检验",
    "oqc_inspection": "出货检验",
    "defect_record": "不合格品",
    "material_binding": "物料绑定",
    "production_picking": "生产领料",
    "reporting_record": "报工",
}


def _node_id(document_type: str, document_code: str) -> str:
    return f"{document_type}:{document_code}"


class TraceGraphAssembler:
    @staticmethod
    async def build(
        anchor: ResolvedTraceAnchor,
        events: List[TraceEventResponse],
        direction: TraceDirection,
    ) -> Tuple[List[TraceNodeResponse], List[TraceEdgeResponse]]:
        nodes: Dict[str, TraceNodeResponse] = {}
        edges: List[TraceEdgeResponse] = []
        edge_keys: Set[Tuple[str, str]] = set()

        def ensure_node(nid: str, label: str, ntype: str, data: dict | None = None) -> None:
            if nid not in nodes:
                nodes[nid] = TraceNodeResponse(id=nid, label=label, type=ntype, data=data or {})

        def add_edge(source: str, target: str, label: str) -> None:
            key = (source, target)
            if key in edge_keys:
                return
            edge_keys.add(key)
            edges.append(TraceEdgeResponse(source=source, target=target, label=label))

        anchor_type = anchor.identifier_type.value
        anchor_nid = _node_id(anchor_type, anchor.code)
        ensure_node(
            anchor_nid,
            anchor.code,
            "serial" if anchor_type == "serial" else anchor_type,
            {
                "material_code": anchor.material_code,
                "material_name": anchor.material_name,
                "material_model": anchor.material_model,
                "status": anchor.status,
                "inbound_date": anchor.inbound_date.isoformat() if anchor.inbound_date else None,
                "work_order_id": anchor.work_order_id,
                "serial_uuid": anchor.serial_uuid,
                "batch_uuid": anchor.batch_uuid,
            },
        )

        wo_codes: Dict[int, str] = {}
        batch_codes: Set[str] = set()
        if anchor.batch_no:
            batch_codes.add(anchor.batch_no)

        for ev in events:
            if ev.document_type in ("serial", "batch") and ev.document_code == anchor.code:
                continue
            ntype = ev.document_type
            if ev.document_type in ("purchase_receipt", "finished_goods_receipt", "semi_finished_goods_receipt", "customer_material_registration"):
                ntype = "inbound"
            elif ev.document_type in ("sales_delivery", "production_picking"):
                ntype = "outbound"
            elif ev.document_type in ("sales_return",):
                ntype = "inbound"
            elif "inspection" in ev.document_type or ev.document_type == "defect_record":
                ntype = ev.document_type

            nid = _node_id(ev.document_type, ev.document_code)
            prefix = _DOC_LABELS.get(ev.document_type, ev.document_type)
            label = f"{prefix}: {ev.document_code}"
            ensure_node(
                nid,
                label,
                ntype,
                {
                    "document_type": ev.document_type,
                    "document_code": ev.document_code,
                    "document_id": ev.document_id,
                    "material_code": ev.material_code,
                    "material_name": ev.material_name,
                    "quality_status": ev.quality_status,
                    "operation_name": ev.remark,
                    "inspection_id": ev.document_id if "inspection" in ev.document_type else None,
                    "defect_id": ev.document_id if ev.document_type == "defect_record" else None,
                    "work_order_id": ev.document_id if ev.document_type == "work_order" else None,
                    "work_order_code": ev.document_code if ev.document_type == "work_order" else None,
                },
            )

            if ev.document_type == "work_order" and ev.document_id:
                wo_codes[int(ev.document_id)] = ev.document_code

        sorted_events = sorted(
            events,
            key=lambda e: (e.event_time is None, e.event_time),
        )
        prev_nid = anchor_nid
        for ev in sorted_events:
            if ev.document_type in ("serial", "batch"):
                continue
            nid = _node_id(ev.document_type, ev.document_code)
            if direction in ("forward", "both"):
                add_edge(prev_nid, nid, _DOC_LABELS.get(ev.document_type, ev.document_type))
            prev_nid = nid

        for ev in events:
            if ev.document_type == "work_order" and ev.document_id:
                wo_nid = _node_id("work_order", ev.document_code)
                for child in events:
                    if child.document_type in (
                        "process_inspection",
                        "finished_goods_inspection",
                        "defect_record",
                    ) and child.document_id:
                        child_nid = _node_id(child.document_type, child.document_code)
                        add_edge(wo_nid, child_nid, "检验")
                    if child.document_type == "production_picking" and child.document_id:
                        child_nid = _node_id(child.document_type, child.document_code)
                        add_edge(wo_nid, child_nid, "领料")

        for ev in events:
            if ev.document_type == "production_picking" and ev.related_batch_no:
                batch_nid = _node_id("batch", ev.related_batch_no)
                ensure_node(batch_nid, ev.related_batch_no, "batch", {"batch_no": ev.related_batch_no})
                pick_nid = _node_id(ev.document_type, ev.document_code)
                add_edge(batch_nid, pick_nid, "生产领料")

        for ev in events:
            if ev.document_type == "purchase_receipt" and ev.document_id:
                pr_nid = _node_id(ev.document_type, ev.document_code)
                for child in events:
                    if (
                        child.document_type == "incoming_inspection"
                        and child.document_id
                    ):
                        add_edge(pr_nid, _node_id(child.document_type, child.document_code), "来料检验")

        for ev in events:
            if ev.document_type == "customer_material_registration" and ev.document_id:
                cm_nid = _node_id(ev.document_type, ev.document_code)
                for child in events:
                    if child.document_type == "incoming_inspection" and child.document_id:
                        add_edge(cm_nid, _node_id(child.document_type, child.document_code), "来料检验")

        for ev in events:
            if ev.document_type in ("purchase_receipt", "customer_material_registration") and ev.related_batch_no:
                batch_nid = _node_id("batch", ev.related_batch_no)
                ensure_node(batch_nid, ev.related_batch_no, "batch", {"batch_no": ev.related_batch_no})
                inbound_nid = _node_id(ev.document_type, ev.document_code)
                add_edge(batch_nid, inbound_nid, _DOC_LABELS.get(ev.document_type, ev.document_type))

        for ev in events:
            if ev.document_type == "finished_goods_receipt" and ev.document_id:
                fgr_nid = _node_id(ev.document_type, ev.document_code)
                for wo_ev in events:
                    if wo_ev.document_type == "work_order" and wo_ev.document_code:
                        wo_nid = _node_id("work_order", wo_ev.document_code)
                        add_edge(wo_nid, fgr_nid, "成品入库")
                        break

        if anchor.identifier_type in (TraceIdentifierType.batch, TraceIdentifierType.serial):
            batch_no = anchor.batch_no or (anchor.code if anchor.identifier_type == TraceIdentifierType.batch else None)
            if batch_no:
                batch_codes.add(batch_no)
            for bn in batch_codes:
                await TraceGraphAssembler._append_binding_chain(
                    tenant_id=anchor.tenant_id,
                    batch_no=bn,
                    nodes=nodes,
                    edges=edges,
                    edge_keys=edge_keys,
                    direction=direction,
                    ensure_node=ensure_node,
                    add_edge=add_edge,
                )

        if len(nodes) == 1 and len(edges) == 0 and len(events) > 1:
            anchor_node = nodes[anchor_nid]
            for ev in sorted_events[1:6]:
                if ev.document_type in ("serial", "batch"):
                    continue
                add_edge(anchor_nid, _node_id(ev.document_type, ev.document_code), "关联")

        await TraceGraphAssembler._append_document_relation_edges(
            tenant_id=anchor.tenant_id,
            events=events,
            nodes=nodes,
            add_edge=add_edge,
        )

        return list(nodes.values()), edges

    @staticmethod
    async def _append_document_relation_edges(
        *,
        tenant_id: int,
        events: List[TraceEventResponse],
        nodes: Dict[str, TraceNodeResponse],
        add_edge,
    ) -> None:
        """DocumentRelation 补边：仅连接图谱中已有节点，不替代主数据事件。"""
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        id_to_nid: Dict[tuple[str, int], str] = {}
        code_to_nid: Dict[tuple[str, str], str] = {}
        for ev in events:
            if not ev.document_id or ev.document_type in ("serial", "batch"):
                continue
            nid = _node_id(ev.document_type, ev.document_code)
            id_to_nid[(ev.document_type, int(ev.document_id))] = nid
            if ev.document_code:
                code_to_nid[(ev.document_type, ev.document_code)] = nid

        if not id_to_nid:
            return

        doc_ids_by_type: Dict[str, Set[int]] = {}
        for doc_type, doc_id in id_to_nid:
            doc_ids_by_type.setdefault(doc_type, set()).add(doc_id)

        relations = []
        for doc_type, ids in doc_ids_by_type.items():
            id_list = list(ids)
            relations.extend(
                await DocumentRelation.filter(
                    tenant_id=tenant_id,
                    source_type=doc_type,
                    source_id__in=id_list,
                ).all()
            )
            relations.extend(
                await DocumentRelation.filter(
                    tenant_id=tenant_id,
                    target_type=doc_type,
                    target_id__in=id_list,
                ).all()
            )

        seen_rel: Set[int] = set()
        for rel in relations:
            rid = int(rel.id)
            if rid in seen_rel:
                continue
            seen_rel.add(rid)

            source_nid = id_to_nid.get((rel.source_type, int(rel.source_id)))
            if not source_nid and rel.source_code:
                source_nid = code_to_nid.get((rel.source_type, rel.source_code))
            target_nid = id_to_nid.get((rel.target_type, int(rel.target_id)))
            if not target_nid and rel.target_code:
                target_nid = code_to_nid.get((rel.target_type, rel.target_code))

            if not source_nid or not target_nid:
                continue
            if source_nid not in nodes or target_nid not in nodes:
                continue
            label = rel.relation_desc or rel.relation_mode or "关联"
            add_edge(source_nid, target_nid, label)

    @staticmethod
    async def _append_binding_chain(
        *,
        tenant_id: int,
        batch_no: str,
        nodes: Dict[str, TraceNodeResponse],
        edges: List[TraceEdgeResponse],
        edge_keys: Set[Tuple[str, str]],
        direction: TraceDirection,
        ensure_node,
        add_edge,
    ) -> None:
        batch_nid = _node_id("batch", batch_no)
        ensure_node(batch_nid, batch_no, "batch", {"batch_no": batch_no})

        if direction in ("forward", "both"):
            feedings = await MaterialBinding.filter(
                tenant_id=tenant_id,
                batch_no=batch_no,
                binding_type="feeding",
                deleted_at__isnull=True,
            ).all()
            for feeding in feedings:
                wo_nid = _node_id("work_order", feeding.work_order_code)
                ensure_node(
                    wo_nid,
                    f"工单: {feeding.work_order_code}",
                    "work_order",
                    {
                        "work_order_id": feeding.work_order_id,
                        "work_order_code": feeding.work_order_code,
                        "operation_name": feeding.operation_name,
                    },
                )
                add_edge(batch_nid, wo_nid, "投料")
                dischargings = await MaterialBinding.filter(
                    tenant_id=tenant_id,
                    work_order_id=feeding.work_order_id,
                    binding_type="discharging",
                    deleted_at__isnull=True,
                ).all()
                for d in dischargings:
                    if not d.batch_no:
                        continue
                    out_nid = _node_id("batch", d.batch_no)
                    ensure_node(
                        out_nid,
                        d.batch_no,
                        "batch",
                        {
                            "material_code": d.material_code,
                            "material_name": d.material_name,
                        },
                    )
                    add_edge(wo_nid, out_nid, "产出")

        if direction in ("backward", "both"):
            dischargings = await MaterialBinding.filter(
                tenant_id=tenant_id,
                batch_no=batch_no,
                binding_type="discharging",
                deleted_at__isnull=True,
            ).all()
            for d in dischargings:
                wo_nid = _node_id("work_order", d.work_order_code)
                ensure_node(
                    wo_nid,
                    f"工单: {d.work_order_code}",
                    "work_order",
                    {
                        "work_order_id": d.work_order_id,
                        "work_order_code": d.work_order_code,
                        "operation_name": d.operation_name,
                    },
                )
                add_edge(wo_nid, batch_nid, "产出")
                feedings = await MaterialBinding.filter(
                    tenant_id=tenant_id,
                    work_order_id=d.work_order_id,
                    binding_type="feeding",
                    deleted_at__isnull=True,
                ).all()
                for f in feedings:
                    if not f.batch_no:
                        continue
                    in_nid = _node_id("batch", f.batch_no)
                    ensure_node(
                        in_nid,
                        f.batch_no,
                        "batch",
                        {
                            "material_code": f.material_code,
                            "material_name": f.material_name,
                        },
                    )
                    add_edge(in_nid, wo_nid, "投料")
