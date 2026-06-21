"""追溯图谱组装单元测试（DocumentRelation 补边）。"""

import asyncio
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from apps.kuaizhizao.services.traceability.graph_assembler import TraceGraphAssembler
import apps.kuaizhizao.schemas.traceability_schemas as trace_schemas

TraceEventResponse = trace_schemas.TraceEventResponse
TraceIdentifierType = trace_schemas.TraceIdentifierType
TraceNodeResponse = trace_schemas.TraceNodeResponse


def _event(**kwargs):
    defaults = {
        "event_id": "ev-1",
        "event_time": datetime(2026, 6, 21, 10, 0, 0),
        "biz_step": "storing",
        "document_type": "finished_goods_receipt",
        "document_code": "FGR-001",
        "document_id": 101,
        "material_code": "M-01",
        "material_name": "产品A",
        "quantity": None,
        "location": None,
        "operator": None,
        "remark": None,
        "source_table": "test",
        "quality_status": None,
    }
    defaults.update(kwargs)
    return TraceEventResponse(**defaults)


def _nodes_map(*pairs):
    return {
        nid: TraceNodeResponse(id=nid, label=nid, type=ntype, data={})
        for nid, ntype in pairs
    }


def test_document_relation_supplements_edge_between_existing_nodes():
    events = [
        _event(
            event_id="wo-1",
            document_type="work_order",
            document_code="WO-001",
            document_id=10,
            biz_step="commissioning",
        ),
        _event(),
    ]
    nodes = _nodes_map(
        ("work_order:WO-001", "work_order"),
        ("finished_goods_receipt:FGR-001", "inbound"),
    )
    added = []

    relation = SimpleNamespace(
        id=1,
        source_type="work_order",
        source_id=10,
        source_code="WO-001",
        target_type="finished_goods_receipt",
        target_id=101,
        target_code="FGR-001",
        relation_desc="成品入库",
        relation_mode="push",
    )

    async def _run():
        mock_qs = MagicMock()
        mock_qs.all = AsyncMock(return_value=[relation])
        with patch(
            "apps.kuaizhizao.models.document_relation.DocumentRelation.filter",
            return_value=mock_qs,
        ):
            await TraceGraphAssembler._append_document_relation_edges(
                tenant_id=1,
                events=events,
                nodes=nodes,
                add_edge=lambda s, t, l: added.append((s, t, l)),
            )

    asyncio.run(_run())
    assert ("work_order:WO-001", "finished_goods_receipt:FGR-001", "成品入库") in added


def test_build_dedupes_same_source_target_edge():
    """工单→成品入库 与 DocumentRelation 补边重复时只保留一条边。"""
    asyncio.run(_test_build_dedupes_same_source_target_edge())


async def _test_build_dedupes_same_source_target_edge():
    from apps.kuaizhizao.services.traceability.identifier_resolver import ResolvedTraceAnchor

    anchor = ResolvedTraceAnchor(
        identifier_type=TraceIdentifierType.serial,
        code="SN-001",
        tenant_id=1,
    )
    events = [
        _event(
            event_id="wo-1",
            document_type="work_order",
            document_code="GD202606210002",
            document_id=10,
            biz_step="commissioning",
        ),
        _event(
            event_id="fgr-1",
            document_type="finished_goods_receipt",
            document_code="CPRK202606210001",
            document_id=101,
        ),
    ]
    relation = SimpleNamespace(
        id=1,
        source_type="work_order",
        source_id=10,
        source_code="GD202606210002",
        target_type="finished_goods_receipt",
        target_id=101,
        target_code="CPRK202606210001",
        relation_desc="下推",
        relation_mode="push",
    )

    with patch(
        "apps.kuaizhizao.services.traceability.graph_assembler.MaterialBinding.filter",
        new_callable=AsyncMock,
    ) as mock_binding:
        mock_binding.return_value.all = AsyncMock(return_value=[])
        mock_qs = MagicMock()
        mock_qs.all = AsyncMock(return_value=[relation])
        with patch(
            "apps.kuaizhizao.models.document_relation.DocumentRelation.filter",
            return_value=mock_qs,
        ):
            nodes, edges = await TraceGraphAssembler.build(anchor, events, "both")

    wo_fgr = [
        e for e in edges
        if e.source == "work_order:GD202606210002"
        and e.target == "finished_goods_receipt:CPRK202606210001"
    ]
    assert len(wo_fgr) == 1


def test_document_relation_skips_unknown_nodes():
    events = [_event()]
    nodes = _nodes_map(("finished_goods_receipt:FGR-001", "inbound"))
    added = []

    relation = SimpleNamespace(
        id=2,
        source_type="work_order",
        source_id=99,
        source_code="WO-999",
        target_type="finished_goods_receipt",
        target_id=101,
        target_code="FGR-001",
        relation_desc="关联",
        relation_mode="push",
    )

    async def _run():
        mock_qs = MagicMock()
        mock_qs.all = AsyncMock(return_value=[relation])
        with patch(
            "apps.kuaizhizao.models.document_relation.DocumentRelation.filter",
            return_value=mock_qs,
        ):
            await TraceGraphAssembler._append_document_relation_edges(
                tenant_id=1,
                events=events,
                nodes=nodes,
                add_edge=lambda s, t, l: added.append((s, t, l)),
            )

    asyncio.run(_run())
    assert added == []
