"""图档借阅单与密级授权 API"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status
from loguru import logger

from apps.master_data.api._master_data_route_access import require_master_data_module_access
from apps.master_data.schemas.drawing_loan_schemas import (
    DrawingClearanceListResponse,
    DrawingClearanceResponse,
    DrawingClearanceUpsert,
    DrawingLoanCreate,
    DrawingLoanListResponse,
    DrawingLoanResponse,
    DrawingLoanUpdate,
)
from apps.master_data.services.drawing_loan_service import DrawingLoanService
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import AuthorizationError, NotFoundError, ValidationError
from infra.models.user import User

loan_router = APIRouter(
    prefix="/process/drawing-loans",
    tags=["App - Master Data - Drawing Loans"],
    dependencies=[Depends(require_master_data_module_access("process:drawing-loan"))],
)

clearance_router = APIRouter(
    prefix="/process/drawing-clearances",
    tags=["App - Master Data - Drawing Clearances"],
    dependencies=[Depends(require_master_data_module_access("process:drawing-loan"))],
)


def _http_exception(status_code: int, message: str, route: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_drawing_loan_api_error trace_id={} route={} status_code={} message={}",
        trace_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def _raise_service_error(exc: Exception, route: str) -> FastAPIHTTPException:
    if isinstance(exc, AuthorizationError):
        return _http_exception(status.HTTP_403_FORBIDDEN, str(exc), route)
    if isinstance(exc, NotFoundError):
        return _http_exception(status.HTTP_404_NOT_FOUND, str(exc), route)
    if isinstance(exc, ValidationError):
        return _http_exception(status.HTTP_400_BAD_REQUEST, str(exc), route)
    raise exc


@loan_router.get(
    "",
    response_model=DrawingLoanListResponse,
    response_model_by_alias=True,
    summary="List drawing loans",
)
async def list_loans(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
):
    return await DrawingLoanService.list_loans(
        tenant_id, skip=skip, limit=limit, status=status, keyword=keyword
    )


@loan_router.post(
    "",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Create drawing loan",
)
async def create_loan(
    body: DrawingLoanCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.create(tenant_id, body, current_user)
    except (ValidationError, NotFoundError, AuthorizationError) as e:
        raise _raise_service_error(e, "/process/drawing-loans")


@loan_router.get(
    "/{loan_uuid}",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Get drawing loan",
)
async def get_loan(
    loan_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await DrawingLoanService.get(tenant_id, loan_uuid)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-loans/{loan_uuid}")


@loan_router.put(
    "/{loan_uuid}",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Update drawing loan",
)
async def update_loan(
    loan_uuid: str,
    body: DrawingLoanUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.update(tenant_id, loan_uuid, body, current_user)
    except (ValidationError, NotFoundError, AuthorizationError) as e:
        raise _raise_service_error(e, f"/process/drawing-loans/{loan_uuid}")


@loan_router.delete("/{loan_uuid}", summary="Delete drawing loan")
async def delete_loan(
    loan_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await DrawingLoanService.delete(tenant_id, loan_uuid)
        return {"success": True}
    except (ValidationError, NotFoundError) as e:
        raise _raise_service_error(e, f"/process/drawing-loans/{loan_uuid}")


@loan_router.post(
    "/{loan_uuid}/submit",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Submit drawing loan",
)
async def submit_loan(
    loan_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.submit(tenant_id, loan_uuid, current_user)
    except (ValidationError, NotFoundError) as e:
        raise _raise_service_error(e, f"/process/drawing-loans/{loan_uuid}/submit")


@loan_router.post(
    "/{loan_uuid}/approve",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Approve drawing loan",
)
async def approve_loan(
    loan_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.approve(tenant_id, loan_uuid, current_user)
    except (ValidationError, NotFoundError) as e:
        raise _raise_service_error(e, f"/process/drawing-loans/{loan_uuid}/approve")


@loan_router.post(
    "/{loan_uuid}/reject",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Reject drawing loan",
)
async def reject_loan(
    loan_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.reject(tenant_id, loan_uuid, current_user)
    except (ValidationError, NotFoundError) as e:
        raise _raise_service_error(e, f"/process/drawing-loans/{loan_uuid}/reject")


@loan_router.post(
    "/{loan_uuid}/revoke",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Revoke drawing loan",
)
async def revoke_loan(
    loan_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.revoke(tenant_id, loan_uuid, current_user)
    except (ValidationError, NotFoundError) as e:
        raise _raise_service_error(e, f"/process/drawing-loans/{loan_uuid}/revoke")


@loan_router.post(
    "/{loan_uuid}/complete",
    response_model=DrawingLoanResponse,
    response_model_by_alias=True,
    summary="Return borrowed drawings",
)
async def complete_loan(
    loan_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.complete(tenant_id, loan_uuid, current_user)
    except (ValidationError, NotFoundError) as e:
        raise _raise_service_error(e, f"/process/drawing-loans/{loan_uuid}/complete")


@clearance_router.get(
    "",
    response_model=DrawingClearanceListResponse,
    response_model_by_alias=True,
    summary="List drawing clearances",
)
async def list_clearances(tenant_id: Annotated[int, Depends(get_current_tenant)]):
    return await DrawingLoanService.list_clearances(tenant_id)


@clearance_router.put(
    "",
    response_model=DrawingClearanceResponse,
    response_model_by_alias=True,
    summary="Upsert drawing clearance",
)
async def upsert_clearance(
    body: DrawingClearanceUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: User = Depends(get_current_user),
):
    try:
        return await DrawingLoanService.upsert_clearance(tenant_id, body, current_user)
    except (ValidationError, NotFoundError) as e:
        raise _raise_service_error(e, "/process/drawing-clearances")


@clearance_router.delete("/{user_id}", summary="Delete drawing clearance")
async def delete_clearance(
    user_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await DrawingLoanService.delete_clearance(tenant_id, user_id)
        return {"success": True}
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e), f"/process/drawing-clearances/{user_id}")
