"""服务派工单 API"""

from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_service import (
    ServiceDispatchAssign,
    ServiceDispatchCancel,
    ServiceDispatchCheckin,
    ServiceDispatchComplete,
    ServiceDispatchCreate,
    ServiceDispatchListEnvelope,
    ServiceDispatchResponse,
    ServiceDispatchUpdate,
)
from apps.kuaizhizao.services.service_dispatch_service import ServiceDispatchService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/after-sales/dispatch-orders",
    tags=["App - Kuaige Zhizao - Service Dispatch"],
    dependencies=[Depends(require_kuaizhizao_module_access("service-dispatch"))],
)
_service = ServiceDispatchService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaizhizao_dispatch_orders_api_error trace_id={} message={}", trace_id, message)
    return FastAPIHTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception(status_code, message)


@router.post("", response_model=ServiceDispatchResponse, summary="Create service dispatch")
async def create_dispatch(
    body: ServiceDispatchCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=ServiceDispatchListEnvelope, summary="List service dispatches")
async def list_dispatches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    engineer_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_dispatches(
        tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        status=status_filter,
        engineer_id=engineer_id,
        keyword=keyword,
    )


@router.get("/{dispatch_id}", response_model=ServiceDispatchResponse, summary="Get service dispatch")
async def get_dispatch(
    dispatch_id: int = Path(..., description="派工单ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, dispatch_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{dispatch_id}", response_model=ServiceDispatchResponse, summary="Update service dispatch")
async def update_dispatch(
    body: ServiceDispatchUpdate,
    dispatch_id: int = Path(..., description="派工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, dispatch_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{dispatch_id}/assign", response_model=ServiceDispatchResponse, summary="Assign engineer")
async def assign_dispatch(
    body: ServiceDispatchAssign,
    dispatch_id: int = Path(..., description="派工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.assign(tenant_id, dispatch_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{dispatch_id}/accept", response_model=ServiceDispatchResponse, summary="Accept dispatch")
async def accept_dispatch(
    dispatch_id: int = Path(..., description="派工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.accept(tenant_id, dispatch_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{dispatch_id}/checkin", response_model=ServiceDispatchResponse, summary="Check in on site")
async def checkin_dispatch(
    body: ServiceDispatchCheckin,
    dispatch_id: int = Path(..., description="派工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.checkin(tenant_id, dispatch_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{dispatch_id}/complete", response_model=ServiceDispatchResponse, summary="Complete dispatch")
async def complete_dispatch(
    body: ServiceDispatchComplete,
    dispatch_id: int = Path(..., description="派工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.complete(tenant_id, dispatch_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{dispatch_id}/cancel", response_model=ServiceDispatchResponse, summary="Cancel dispatch")
async def cancel_dispatch(
    body: ServiceDispatchCancel,
    dispatch_id: int = Path(..., description="派工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.cancel(tenant_id, dispatch_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{dispatch_id}", summary="Delete service dispatch")
async def delete_dispatch(
    dispatch_id: int = Path(..., description="派工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, dispatch_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
