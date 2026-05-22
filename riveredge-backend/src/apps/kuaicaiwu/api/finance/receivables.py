"""
应收管理 API 路由
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    ReceivableCreate, ReceivableUpdate, ReceivableResponse, ReceivableListResponse,
    ReceiptRecordCreate
)
from apps.kuaicaiwu.services.finance_service import ReceivableService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/receivables", tags=["App · Kuaicaiwu · Finance"])

receivable_service = ReceivableService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_receivables_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("", response_model=ReceivableResponse, status_code=status.HTTP_201_CREATED)
async def create_receivable(
    data: ReceivableCreate,
    _auth: object = Depends(
        require_access(
            "finance.receivable",
            "create",
            required_permissions=["kuaicaiwu:receivable:create"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.create_receivable(tenant_id, data, current_user.id)
        return ReceivableResponse.model_validate(receivable)
    except ValidationError as e:
        raise _http_exception_with_trace(422, str(e), "/receivables", tenant_id)


@router.get("", response_model=ReceivableListResponse)
async def list_receivables(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    pending_settlement: bool = Query(False, description="仅返回待核销应收（remaining_amount > 0）"),
    _auth: object = Depends(
        require_access(
            "finance.receivable",
            "read",
            required_permissions=["kuaicaiwu:receivable:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant)
):
    receivables, total = await receivable_service.list_receivables(
        tenant_id,
        skip,
        limit,
        status=status,
        customer_id=customer_id,
        pending_settlement=pending_settlement,
    )
    return ReceivableListResponse(
        items=receivables,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{id}", response_model=ReceivableResponse)
async def get_receivable(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.receivable",
            "read",
            required_permissions=["kuaicaiwu:receivable:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.get_receivable_by_id(tenant_id, id)
        return receivable
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/receivables/{id}", tenant_id)


@router.post("/{id}/receipt", response_model=ReceivableResponse)
async def record_receipt(
    id: int,
    data: ReceiptRecordCreate,
    _auth: object = Depends(
        require_access(
            "finance.receivable",
            "update",
            required_permissions=["kuaicaiwu:receivable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.record_receipt(tenant_id, id, data, current_user.id)
        return receivable
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/receivables/{id}/receipt", tenant_id)


@router.post("/{id}/approve", response_model=ReceivableResponse)
async def approve_receivable(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    _auth: object = Depends(
        require_access(
            "finance.receivable",
            "update",
            required_permissions=["kuaicaiwu:receivable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.approve_receivable(tenant_id, id, current_user.id, rejection_reason)
        return receivable
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/receivables/{id}/approve", tenant_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receivable(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.receivable",
            "delete",
            required_permissions=["kuaicaiwu:receivable:delete"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await receivable_service.delete_receivable(tenant_id, id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/receivables/{id}", tenant_id)
