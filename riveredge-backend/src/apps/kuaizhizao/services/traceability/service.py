"""
追溯服务门面：标识解析 → 事件采集 → 图谱组装 → 报告
"""

from datetime import datetime
from typing import Dict, Optional

from apps.kuaizhizao.schemas.traceability_schemas import (
    TraceAnchorResponse,
    TraceDirection,
    TraceGraphResponse,
    TraceProfileResponse,
    TraceSummaryResponse,
)
from apps.kuaizhizao.services.traceability.event_collector import TraceEventCollector
from apps.kuaizhizao.services.traceability.graph_assembler import TraceGraphAssembler
from apps.kuaizhizao.services.traceability.identifier_resolver import (
    ResolvedTraceAnchor,
    TraceIdentifierResolver,
)
from apps.kuaizhizao.services.traceability.report_service import TraceReportService


class TraceabilityService:
    def __init__(self) -> None:
        self._collector = TraceEventCollector()

    async def build_profile(
        self,
        tenant_id: int,
        code: str,
        direction: TraceDirection = "both",
    ) -> TraceProfileResponse:
        anchor = await TraceIdentifierResolver.resolve(tenant_id, code)
        return await self._build_profile_from_anchor(anchor, direction)

    async def build_profile_by_serial_uuid(
        self,
        tenant_id: int,
        serial_uuid: str,
        direction: TraceDirection = "both",
    ) -> TraceProfileResponse:
        anchor = await TraceIdentifierResolver.resolve_serial_uuid(tenant_id, serial_uuid)
        return await self._build_profile_from_anchor(anchor, direction)

    async def build_profile_by_batch_uuid(
        self,
        tenant_id: int,
        batch_uuid: str,
        direction: TraceDirection = "both",
    ) -> TraceProfileResponse:
        anchor = await TraceIdentifierResolver.resolve_batch_uuid(tenant_id, batch_uuid)
        return await self._build_profile_from_anchor(anchor, direction)

    async def build_profile_by_work_order_id(
        self,
        tenant_id: int,
        work_order_id: int,
        direction: TraceDirection = "both",
    ) -> TraceProfileResponse:
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.schemas.traceability_schemas import TraceIdentifierType
        from infra.exceptions.exceptions import NotFoundError

        wo = await WorkOrder.get_or_none(id=work_order_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not wo:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        anchor = ResolvedTraceAnchor(
            identifier_type=TraceIdentifierType.work_order,
            code=wo.code,
            tenant_id=tenant_id,
            material_id=getattr(wo, "product_id", None),
            material_code=getattr(wo, "product_code", None),
            material_name=getattr(wo, "product_name", None),
            work_order_id=wo.id,
        )
        return await self._build_profile_from_anchor(anchor, direction)

    async def _build_profile_from_anchor(
        self,
        anchor: ResolvedTraceAnchor,
        direction: TraceDirection,
    ) -> TraceProfileResponse:
        events = await self._collector.collect(anchor)
        nodes, edges = await TraceGraphAssembler.build(anchor, events, direction)

        timed = [e.event_time for e in events if e.event_time is not None]
        summary = TraceSummaryResponse(
            event_count=len(events),
            node_count=len(nodes),
            edge_count=len(edges),
            time_from=min(timed) if timed else None,
            time_to=max(timed) if timed else None,
            direction=direction,
        )

        return TraceProfileResponse(
            anchor=TraceAnchorResponse(
                identifier_type=anchor.identifier_type,
                code=anchor.code,
                material_id=anchor.material_id,
                material_code=anchor.material_code,
                material_name=anchor.material_name,
                material_model=anchor.material_model,
                status=anchor.status,
                inbound_date=anchor.inbound_date,
                serial_uuid=anchor.serial_uuid,
                batch_uuid=anchor.batch_uuid,
                work_order_id=anchor.work_order_id,
            ),
            summary=summary,
            events=events,
            nodes=nodes,
            edges=edges,
        )

    async def get_trace_graph(self, tenant_id: int, batch_no: str, direction: TraceDirection = "both") -> Dict:
        profile = await self.build_profile(tenant_id, batch_no, direction)
        return TraceGraphResponse(
            nodes=[n.model_dump(by_alias=True) for n in profile.nodes],
            edges=[e.model_dump(by_alias=True) for e in profile.edges],
        ).model_dump(by_alias=True)

    async def get_trace_graph_by_work_order(
        self, tenant_id: int, work_order_id: int
    ) -> Dict:
        profile = await self.build_profile_by_work_order_id(tenant_id, work_order_id, "both")
        return TraceGraphResponse(
            nodes=[n.model_dump(by_alias=True) for n in profile.nodes],
            edges=[e.model_dump(by_alias=True) for e in profile.edges],
        ).model_dump(by_alias=True)

    async def generate_report_pdf(
        self,
        tenant_id: int,
        code: str,
        direction: TraceDirection,
        *,
        company_name: str,
        generated_by: Optional[str] = None,
    ):
        profile = await self.build_profile(tenant_id, code, direction)
        return await TraceReportService.generate_pdf(
            profile,
            tenant_id=tenant_id,
            company_name=company_name,
            generated_by=generated_by,
        )
