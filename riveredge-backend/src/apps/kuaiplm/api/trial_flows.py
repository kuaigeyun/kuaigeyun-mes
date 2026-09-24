"""试流 API（R-08）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.trial_flow import (
    TrialFlowConclude,
    TrialFlowCreate,
    TrialFlowFormProfile,
    TrialFlowListResponse,
    TrialFlowResponse,
    TrialFlowStepFill,
    TrialFlowUpdate,
)
from apps.kuaiplm.services.trial_flow_service import TrialFlowService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/trial-flows", tags=["App - Kuaiplm - Trial Flow"])
service = TrialFlowService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/meta/form-profile",
    response_model=TrialFlowFormProfile,
    summary="Trial flow form profile (generic or industry)",
)
async def get_trial_flow_form_profile(
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_form_profile(tenant_id)
    except Exception as e:
        raise _http(e)


@router.get("", response_model=TrialFlowListResponse)
async def list_trial_flows(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    business_type: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            business_type=business_type,
            project_id=project_id,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise _http(e)


@router.post("", response_model=TrialFlowResponse, status_code=status.HTTP_201_CREATED)
async def create_trial_flow(
    data: TrialFlowCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get("/{trial_id}", response_model=TrialFlowResponse)
async def get_trial_flow(
    trial_id: int,
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, trial_id)
    except Exception as e:
        raise _http(e)


@router.put("/{trial_id}", response_model=TrialFlowResponse)
async def update_trial_flow(
    trial_id: int,
    data: TrialFlowUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, trial_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{trial_id}/submit", response_model=TrialFlowResponse)
async def submit_trial_flow(
    trial_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, trial_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{trial_id}/approve", response_model=TrialFlowResponse)
async def approve_trial_flow(
    trial_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, trial_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{trial_id}/reject", response_model=TrialFlowResponse)
async def reject_trial_flow(
    trial_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, trial_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{trial_id}/steps/{step_key}/fill", response_model=TrialFlowResponse)
async def fill_trial_flow_step(
    trial_id: int,
    step_key: str,
    data: TrialFlowStepFill,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.fill_step(tenant_id, trial_id, step_key, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{trial_id}/conclude", response_model=TrialFlowResponse)
async def conclude_trial_flow(
    trial_id: int,
    data: TrialFlowConclude,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.conclude(tenant_id, trial_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{trial_id}/close", response_model=TrialFlowResponse)
async def close_trial_flow(
    trial_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.close(tenant_id, trial_id, current_user)
    except Exception as e:
        raise _http(e)


@router.delete("/{trial_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trial_flow(
    trial_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:trial-flow:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, trial_id, current_user)
    except Exception as e:
        raise _http(e)
