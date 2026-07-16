"""
往来对账单 API
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    PartnerStatementCreate,
    PartnerStatementDisputeRequest,
    PartnerStatementListResponse,
    PartnerStatementMarkSentRequest,
    PartnerStatementPreviewResponse,
    PartnerStatementResponse,
)
from apps.kuaicaiwu.services.partner_statement_service import PartnerStatementService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/partner-statements", tags=["App - Kuaicaiwu - Partner Statements"])
service = PartnerStatementService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_partner_statements_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def _to_response(obj) -> PartnerStatementResponse:
    return PartnerStatementResponse.model_validate(obj)


@router.get("/preview", response_model=PartnerStatementPreviewResponse)
async def preview_partner_statement(
    partner_id: int = Query(...),
    partner_type: str = Query(..., description="Customer 或 Supplier"),
    start_date: date = Query(...),
    end_date: date = Query(...),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        data = await service.preview_statement(tenant_id, partner_id, partner_type, start_date, end_date)
        return PartnerStatementPreviewResponse.model_validate(data)
    except (ValidationError, NotFoundError) as e:
        raise _http_exception_with_trace(400, str(e), "/partner-statements/preview", tenant_id)


@router.post("", response_model=PartnerStatementResponse, status_code=status.HTTP_201_CREATED)
async def create_partner_statement(
    data: PartnerStatementCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        obj = await service.create_statement(
            tenant_id=tenant_id,
            partner_id=data.partner_id,
            partner_type=data.partner_type,
            period=data.statement_period,
            created_by=current_user.id,
            notes=data.notes,
            attachments=data.attachments,
            start_date=data.start_date,
            end_date=data.end_date,
        )
        return _to_response(obj)
    except (ValidationError, NotFoundError, BusinessLogicError) as e:
        raise _http_exception_with_trace(400, str(e), "/partner-statements", tenant_id)


@router.get("", response_model=PartnerStatementListResponse)
async def list_partner_statements(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    partner_type: Optional[str] = None,
    partner_id: Optional[int] = None,
    statement_period: Optional[str] = None,
    status: Optional[str] = None,
    keyword: Optional[str] = Query(None),
    statement_code: Optional[str] = Query(None),
    partner_name: Optional[str] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await service.list_statements(
        tenant_id,
        skip=skip,
        limit=limit,
        partner_type=partner_type,
        partner_id=partner_id,
        statement_period=statement_period,
        status=status,
        keyword=keyword,
        statement_code=statement_code,
        partner_name=partner_name,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        sort_field=sort_field,
        sort_order=sort_order,
    )
    return PartnerStatementListResponse(
        items=[_to_response(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{id}", response_model=PartnerStatementResponse)
async def get_partner_statement(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        obj = await service.get_statement(tenant_id, id)
        return _to_response(obj)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/partner-statements/{id}", tenant_id)


@router.post("/{id}/confirm", response_model=PartnerStatementResponse)
async def confirm_partner_statement(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        obj = await service.confirm_statement(tenant_id, id, current_user.id)
        return _to_response(obj)
    except (NotFoundError, BusinessLogicError) as e:
        code = 404 if isinstance(e, NotFoundError) else 400
        raise _http_exception_with_trace(code, str(e), "/partner-statements/{id}/confirm", tenant_id)


@router.post("/{id}/mark-sent", response_model=PartnerStatementResponse)
async def mark_partner_statement_sent(
    id: int,
    body: PartnerStatementMarkSentRequest,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        obj = await service.mark_sent(
            tenant_id, id, current_user.id, body.channel, body.notes
        )
        return _to_response(obj)
    except (NotFoundError, BusinessLogicError, ValidationError) as e:
        code = 404 if isinstance(e, NotFoundError) else 400
        raise _http_exception_with_trace(code, str(e), "/partner-statements/{id}/mark-sent", tenant_id)


@router.post("/{id}/dispute", response_model=PartnerStatementResponse)
async def dispute_partner_statement(
    id: int,
    body: PartnerStatementDisputeRequest,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        obj = await service.dispute_statement(tenant_id, id, body.reason, user_id=current_user.id)
        return _to_response(obj)
    except (NotFoundError, BusinessLogicError) as e:
        code = 404 if isinstance(e, NotFoundError) else 400
        raise _http_exception_with_trace(code, str(e), "/partner-statements/{id}/dispute", tenant_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_partner_statement(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_statement(tenant_id, id)
    except (NotFoundError, BusinessLogicError) as e:
        code = 404 if isinstance(e, NotFoundError) else 400
        raise _http_exception_with_trace(code, str(e), "/partner-statements/{id}", tenant_id)


@router.get("/{id}/export")
async def export_partner_statement(
    id: int,
    format: str = Query("xlsx", description="xlsx 或 pdf"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:partner-statement:export")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        obj = await service.get_statement(tenant_id, id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/partner-statements/{id}/export", tenant_id)

    fmt = (format or "xlsx").lower()
    filename_base = f"对账单-{obj.statement_code}"

    if fmt == "xlsx":
        stream = service.export_excel(obj)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.xlsx"'},
        )

    if fmt == "pdf":
        content, media_type = await service.export_pdf(obj)
        ext = "pdf" if "pdf" in media_type else "html"
        return StreamingResponse(
            iter([content]),
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.{ext}"'},
        )

    raise _http_exception_with_trace(422, "format 仅支持 xlsx 或 pdf", "/partner-statements/{id}/export", tenant_id)
