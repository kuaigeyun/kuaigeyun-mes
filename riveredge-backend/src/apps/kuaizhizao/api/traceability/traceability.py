from typing import Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from apps.kuaizhizao.schemas.traceability_schemas import TraceGraphResponse, TraceProfileResponse
from apps.kuaizhizao.services.traceability import TraceabilityService
from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes

router = APIRouter(tags=["App - Kuaige Zhizao - Traceability"])
service = TraceabilityService()

TraceDirection = Literal["forward", "backward", "both"]


def _attachment_content_disposition(filename: str) -> str:
    """RFC 5987：非 ASCII 文件名避免 Content-Disposition latin-1 编码错误。"""
    try:
        filename.encode("latin-1")
        return f'attachment; filename="{filename}"'
    except UnicodeEncodeError:
        encoded = quote(filename, safe="")
        return f"attachment; filename*=UTF-8''{encoded}"


@router.get(
    "/profile",
    response_model=TraceProfileResponse,
    summary="Get traceability profile",
    dependencies=[Depends(require_permission_codes("kuaizhizao:quality-management-traceability:read"))],
)
async def get_trace_profile(
    code: str = Query(..., description="序列号 / 批号 / 工单号"),
    direction: TraceDirection = Query("both", description="追溯方向"),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.build_profile(tenant_id, code, direction)


@router.get(
    "/graph",
    response_model=TraceGraphResponse,
    summary="Get traceability graph (legacy)",
    dependencies=[Depends(require_permission_codes("kuaizhizao:quality-management-traceability:read"))],
)
async def get_trace_graph(
    batch_no: str = Query(..., description="批次号/条码/序列号/工单号"),
    direction: TraceDirection = Query("both", description="追溯方向"),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.get_trace_graph(tenant_id, batch_no, direction)


@router.get(
    "/graph/by-work-order/{work_order_id}",
    response_model=TraceGraphResponse,
    summary="Get traceability graph by work order",
    dependencies=[Depends(require_permission_codes("kuaizhizao:quality-management-traceability:read"))],
)
async def get_trace_graph_by_work_order(
    work_order_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.get_trace_graph_by_work_order(tenant_id, work_order_id)


@router.get(
    "/report",
    summary="Export traceability report PDF",
    dependencies=[Depends(require_permission_codes("kuaizhizao:quality-management-traceability:print"))],
)
async def export_trace_report(
    code: str = Query(..., description="序列号 / 批号 / 工单号"),
    direction: TraceDirection = Query("both", description="追溯方向"),
    format: Literal["pdf"] = Query("pdf", description="报告格式"),
    tenant_id: int = Depends(get_current_tenant),
    current_user=Depends(get_current_user),
):
    from infra.models.tenant import Tenant

    tenant = await Tenant.get_or_none(id=tenant_id)
    company_name = (tenant.name if tenant else None) or "企业"
    generated_by = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)

    pdf_bytes, filename = await service.generate_report_pdf(
        tenant_id,
        code,
        direction,
        company_name=company_name,
        generated_by=generated_by,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": _attachment_content_disposition(filename)},
    )
