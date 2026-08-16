"""图档发放单 API"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status
from loguru import logger

from apps.master_data.api._master_data_route_access import require_master_data_module_access
from apps.master_data.schemas.drawing_distribution_schemas import (
    DrawingDistributionCreate,
    DrawingDistributionListResponse,
    DrawingDistributionPolicyResponse,
    DrawingDistributionPolicyUpdate,
    DrawingDistributionRecallRequest,
    DrawingDistributionResponse,
    DrawingDistributionUpdate,
)
from apps.master_data.services.drawing_distribution_service import DrawingDistributionService
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/process/drawing-distributions",
    tags=["App - Master Data - Drawing Distributions"],
    dependencies=[Depends(require_master_data_module_access("process:drawing-distribution"))],
)


def _http_exception(status_code: int, message: str, route: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_drawing_distribution_api_error trace_id={} route={} status_code={} message={}",
        trace_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.get(
    "/policy",
    response_model=DrawingDistributionPolicyResponse,
    response_model_by_alias=True,
    summary="Get drawing distribution policy",
)
async def get_distribution_policy(tenant_id: Annotated[int, Depends(get_current_tenant)]):
    return await DrawingDistributionService.get_policy(tenant_id)


@router.put(
    "/policy",
    response_model=DrawingDistributionPolicyResponse,
    response_model_by_alias=True,
    summary="Update drawing distribution policy",
)
async def update_distribution_policy(
    body: DrawingDistributionPolicyUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    return await DrawingDistributionService.update_policy(tenant_id, body.is_enabled, current_user)


@router.get(
    "",
    response_model=DrawingDistributionListResponse,
    response_model_by_alias=True,
    summary="List drawing distributions",
)
async def list_distributions(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
):
    return await DrawingDistributionService.list_distributions(
        tenant_id, skip=skip, limit=limit, status=status, keyword=keyword
    )


@router.post(
    "",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Create drawing distribution",
)
async def create_distribution(
    body: DrawingDistributionCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingDistributionService.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), "/process/drawing-distributions")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), "/process/drawing-distributions")


@router.get(
    "/{dist_uuid}",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Get drawing distribution",
)
async def get_distribution(
    dist_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await DrawingDistributionService.get(tenant_id, dist_uuid)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}")


@router.put(
    "/{dist_uuid}",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Update drawing distribution",
)
async def update_distribution(
    dist_uuid: str,
    body: DrawingDistributionUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingDistributionService.update(tenant_id, dist_uuid, body, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), f"/process/drawing-distributions/{dist_uuid}")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}")


@router.delete("/{dist_uuid}", summary="Delete drawing distribution")
async def delete_distribution(
    dist_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await DrawingDistributionService.delete(tenant_id, dist_uuid)
        return {"success": True}
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), f"/process/drawing-distributions/{dist_uuid}")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}")


@router.post(
    "/{dist_uuid}/submit",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Submit drawing distribution",
)
async def submit_distribution(
    dist_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingDistributionService.submit(tenant_id, dist_uuid, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), f"/process/drawing-distributions/{dist_uuid}/submit")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}/submit")


@router.post(
    "/{dist_uuid}/approve",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Approve and issue drawing distribution",
)
async def approve_distribution(
    dist_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingDistributionService.approve(tenant_id, dist_uuid, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), f"/process/drawing-distributions/{dist_uuid}/approve")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}/approve")


@router.post(
    "/{dist_uuid}/reject",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Reject drawing distribution",
)
async def reject_distribution(
    dist_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingDistributionService.reject(tenant_id, dist_uuid, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), f"/process/drawing-distributions/{dist_uuid}/reject")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}/reject")


@router.post(
    "/{dist_uuid}/revoke",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Revoke drawing distribution",
)
async def revoke_distribution(
    dist_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingDistributionService.revoke(tenant_id, dist_uuid, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), f"/process/drawing-distributions/{dist_uuid}/revoke")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}/revoke")


@router.post(
    "/{dist_uuid}/recall",
    response_model=DrawingDistributionResponse,
    response_model_by_alias=True,
    summary="Recall issued drawing distribution",
)
async def recall_distribution(
    dist_uuid: str,
    body: DrawingDistributionRecallRequest,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingDistributionService.recall(tenant_id, dist_uuid, body, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e), f"/process/drawing-distributions/{dist_uuid}/recall")
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-distributions/{dist_uuid}/recall")
