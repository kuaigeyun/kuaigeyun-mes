"""客户回访 API"""

from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_service import (
    CustomerReturnVisitCreate,
    CustomerReturnVisitListEnvelope,
    CustomerReturnVisitResponse,
    CustomerReturnVisitUpdate,
)
from apps.kuaizhizao.services.customer_return_visit_service import CustomerReturnVisitService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/after-sales/return-visits",
    tags=["App - Kuaige Zhizao - Customer Return Visit"],
    dependencies=[Depends(require_kuaizhizao_module_access("customer-return-visit"))],
)
_service = CustomerReturnVisitService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaizhizao_return_visits_api_error trace_id={} message={}", trace_id, message)
    return FastAPIHTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception(status_code, message)


@router.post("", response_model=CustomerReturnVisitResponse, summary="Create return visit")
async def create_visit(
    body: CustomerReturnVisitCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=CustomerReturnVisitListEnvelope, summary="List return visits")
async def list_visits(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_visits(
        tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        keyword=keyword,
    )


@router.get("/{visit_id}", response_model=CustomerReturnVisitResponse, summary="Get return visit")
async def get_visit(
    visit_id: int = Path(..., description="回访单ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, visit_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{visit_id}", response_model=CustomerReturnVisitResponse, summary="Update return visit")
async def update_visit(
    body: CustomerReturnVisitUpdate,
    visit_id: int = Path(..., description="回访单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, visit_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{visit_id}", summary="Delete return visit")
async def delete_visit(
    visit_id: int = Path(..., description="回访单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, visit_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
