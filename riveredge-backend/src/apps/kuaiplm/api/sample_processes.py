"""样品加工申请 API（R-15 #33）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.sample_process import (
    SampleProcessCreate,
    SampleProcessFormProfile,
    SampleProcessListResponse,
    SampleProcessResponse,
    SampleProcessUpdate,
)
from apps.kuaiplm.services.sample_process_service import SampleProcessService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/sample-process-applications", tags=["App - Kuaiplm - Sample Process"])
service = SampleProcessService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/meta/form-profile",
    response_model=SampleProcessFormProfile,
    summary="Sample process form profile (generic or industry)",
)
async def get_sample_process_form_profile(
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_form_profile(tenant_id)
    except Exception as e:
        raise _http(e)


@router.get("", response_model=SampleProcessListResponse, summary="List sample process applications")
async def list_sample_process_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[int] = Query(None),
    request_kind: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            project_id=project_id,
            request_kind=request_kind,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise _http(e)


@router.post(
    "",
    response_model=SampleProcessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create sample process application",
)
async def create_sample_process_application(
    data: SampleProcessCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get(
    "/{application_id}",
    response_model=SampleProcessResponse,
    summary="Get sample process application",
)
async def get_sample_process_application(
    application_id: int,
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, application_id)
    except Exception as e:
        raise _http(e)


@router.put(
    "/{application_id}",
    response_model=SampleProcessResponse,
    summary="Update sample process application",
)
async def update_sample_process_application(
    application_id: int,
    data: SampleProcessUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, application_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{application_id}/submit",
    response_model=SampleProcessResponse,
    summary="Submit",
)
async def submit_sample_process_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, application_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{application_id}/approve",
    response_model=SampleProcessResponse,
    summary="Approve",
)
async def approve_sample_process_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, application_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{application_id}/reject",
    response_model=SampleProcessResponse,
    summary="Reject",
)
async def reject_sample_process_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, application_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{application_id}/close",
    response_model=SampleProcessResponse,
    summary="Close",
)
async def close_sample_process_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.close(tenant_id, application_id, current_user)
    except Exception as e:
        raise _http(e)


@router.delete(
    "/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete draft",
)
async def delete_sample_process_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:sample-process:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, application_id, current_user)
    except Exception as e:
        raise _http(e)
