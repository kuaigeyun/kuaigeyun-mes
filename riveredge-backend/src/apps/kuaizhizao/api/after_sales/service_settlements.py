"""服务结算 API"""

from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_service import (
    ServiceSettlementAudit,
    ServiceSettlementCreate,
    ServiceSettlementListEnvelope,
    ServiceSettlementReject,
    ServiceSettlementResponse,
    ServiceSettlementUpdate,
)
from apps.kuaizhizao.services.service_settlement_service import ServiceSettlementService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/after-sales/service-settlements",
    tags=["App - Kuaige Zhizao - Service Settlement"],
    dependencies=[Depends(require_kuaizhizao_module_access("service-settlement"))],
)
_service = ServiceSettlementService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaizhizao_service_settlements_api_error trace_id={} message={}", trace_id, message)
    return FastAPIHTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception(status_code, message)


@router.post("", response_model=ServiceSettlementResponse, summary="Create service settlement")
async def create_settlement(
    body: ServiceSettlementCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=ServiceSettlementListEnvelope, summary="List service settlements")
async def list_settlements(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_settlements(
        tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        status=status_filter,
        keyword=keyword,
    )


@router.get("/{settlement_id}", response_model=ServiceSettlementResponse, summary="Get service settlement")
async def get_settlement(
    settlement_id: int = Path(..., description="结算单ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, settlement_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{settlement_id}", response_model=ServiceSettlementResponse, summary="Update service settlement")
async def update_settlement(
    body: ServiceSettlementUpdate,
    settlement_id: int = Path(..., description="结算单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, settlement_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{settlement_id}/submit", response_model=ServiceSettlementResponse, summary="Submit settlement")
async def submit_settlement(
    settlement_id: int = Path(..., description="结算单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.submit(tenant_id, settlement_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{settlement_id}/audit", response_model=ServiceSettlementResponse, summary="Audit settlement")
async def audit_settlement(
    body: ServiceSettlementAudit,
    settlement_id: int = Path(..., description="结算单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.audit(tenant_id, settlement_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{settlement_id}/reject", response_model=ServiceSettlementResponse, summary="Reject settlement")
async def reject_settlement(
    body: ServiceSettlementReject,
    settlement_id: int = Path(..., description="结算单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.reject(tenant_id, settlement_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{settlement_id}", summary="Delete service settlement")
async def delete_settlement(
    settlement_id: int = Path(..., description="结算单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, settlement_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
