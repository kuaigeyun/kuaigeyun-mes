"""
发票管理 API 路由（销项/进项统一，从快制造迁移）

提供发票的 CRUD 操作。
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from loguru import logger

from apps.kuaicaiwu.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceListResponse,
    InvoiceStatisticsResponse,
)
from apps.kuaicaiwu.services.invoice_service import InvoiceService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/invoices", tags=["App · Kuaicaiwu · Finance"])

invoice_service = InvoiceService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_invoices_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:invoice:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.create_invoice(tenant_id, data, current_user.id)
        return InvoiceResponse.model_validate(invoice)
    except ValidationError as e:
        raise _http_exception_with_trace(422, str(e), "/invoices", tenant_id)


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:invoice:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    items, total = await invoice_service.list_invoices(
        tenant_id,
        skip,
        limit,
        category,
        status,
        search,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return InvoiceListResponse(
        items=[InvoiceResponse.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/statistics", response_model=InvoiceStatisticsResponse, summary="Invoice list statistics (KPI cards)")
async def get_invoice_statistics(
    _auth: object = Depends(require_permission_codes("kuaicaiwu:invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    """须在 `/{code}` 之前注册。"""
    data = await invoice_service.get_invoice_statistics(tenant_id)
    return InvoiceStatisticsResponse.model_validate(data)


@router.get("/{code}", response_model=InvoiceResponse)
async def get_invoice(
    code: str,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:invoice:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.get_invoice_by_uuid(tenant_id, code)
        return InvoiceResponse.model_validate(invoice)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/invoices/{code}", tenant_id)


@router.put("/{code}", response_model=InvoiceResponse)
async def update_invoice(
    code: str,
    data: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:invoice:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        invoice = await invoice_service.update_invoice(tenant_id, code, data, current_user.id)
        return InvoiceResponse.model_validate(invoice)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/invoices/{code}", tenant_id)


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    code: str,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:invoice:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await invoice_service.delete_invoice(tenant_id, code)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/invoices/{code}", tenant_id)
