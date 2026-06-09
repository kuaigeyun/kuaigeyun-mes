"""
销售商机 API
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.schemas.sales_opportunity import (
    SalesOpportunityCreate,
    SalesOpportunityEnsure,
    SalesOpportunityListEnvelope,
    SalesOpportunityResponse,
    SalesOpportunityUpdate,
)
from apps.kuaizhizao.services.sales_opportunity_service import SalesOpportunityService
from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/sales-opportunities",
    tags=["App · Kuaige Zhizao · Sales Opportunity"],
    dependencies=[Depends(require_kuaizhizao_module_access("sales-opportunity"))],
)

_service = SalesOpportunityService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/sales-opportunities",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_sales_opportunities_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


@router.post("", response_model=SalesOpportunityResponse, summary="Create sales opportunity")
async def create_opportunity(
    body: SalesOpportunityCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/ensure", response_model=SalesOpportunityResponse, summary="Ensure open opportunity for customer or document")
async def ensure_opportunity(
    body: SalesOpportunityEnsure,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.ensure(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=SalesOpportunityListEnvelope, summary="List sales opportunities")
async def list_opportunities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="open / won / lost"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_opportunities(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        status=status,
        current_user=current_user,
    )


@router.get("/{opportunity_id}", response_model=SalesOpportunityResponse, summary="Get sales opportunity")
async def get_opportunity(
    opportunity_id: int = Path(..., description="商机ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, opportunity_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/{opportunity_id}", response_model=SalesOpportunityResponse, summary="Update sales opportunity")
async def update_opportunity(
    body: SalesOpportunityUpdate,
    opportunity_id: int = Path(..., description="商机ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, opportunity_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
