"""
标准成本库 API 路由
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger

from apps.kuaicaiwu.schemas.standard_cost import (
    StandardCostCreate,
    StandardCostUpdate,
    StandardCostResponse,
    StandardCostListResponse,
)
from apps.kuaicaiwu.services.standard_cost_service import StandardCostService
from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/cost/standard-costs",
    tags=["App · Kuaicaiwu · Standard Costs"],
    dependencies=[Depends(require_kuaicaiwu_module_access("standard-cost"))],
)

service = StandardCostService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_standard_costs_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("", response_model=StandardCostResponse, status_code=status.HTTP_201_CREATED)
async def create_standard_cost(
    data: StandardCostCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_standard_cost(tenant_id, data, current_user.id)
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/cost/standard-costs", tenant_id)


@router.get("", response_model=StandardCostListResponse)
async def list_standard_costs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    target_type: Optional[str] = Query(None),
    target_id: Optional[int] = Query(None),
    cost_item_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await service.list_standard_costs(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        target_type=target_type,
        target_id=target_id,
        cost_item_type=cost_item_type,
        is_active=is_active,
        search=search,
    )
    return StandardCostListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{id}", response_model=StandardCostResponse)
async def get_standard_cost(
    id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_standard_cost_by_id(tenant_id, id)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/standard-costs/{id}", tenant_id)


@router.put("/{id}", response_model=StandardCostResponse)
async def update_standard_cost(
    id: int,
    data: StandardCostUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_standard_cost(tenant_id, id, data)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/standard-costs/{id}", tenant_id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_standard_cost(
    id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_standard_cost(tenant_id, id)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/standard-costs/{id}", tenant_id)
