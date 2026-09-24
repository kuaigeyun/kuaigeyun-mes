"""项目建议书 API（R-15 #68）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.project_proposal import (
    ProjectProposalCreate,
    ProjectProposalListResponse,
    ProjectProposalResponse,
    ProjectProposalSupplierFill,
    ProjectProposalUpdate,
)
from apps.kuaiplm.services.project_proposal_service import ProjectProposalService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/project-proposals", tags=["App - Kuaiplm - Project Proposal"])
service = ProjectProposalService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("", response_model=ProjectProposalListResponse, summary="List project proposals")
async def list_project_proposals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[int] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            project_id=project_id,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise _http(e)


@router.post(
    "",
    response_model=ProjectProposalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create project proposal",
)
async def create_project_proposal(
    data: ProjectProposalCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get("/{proposal_id}", response_model=ProjectProposalResponse, summary="Get")
async def get_project_proposal(
    proposal_id: int,
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, proposal_id)
    except Exception as e:
        raise _http(e)


@router.put("/{proposal_id}", response_model=ProjectProposalResponse, summary="Update header")
async def update_project_proposal(
    proposal_id: int,
    data: ProjectProposalUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, proposal_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.put(
    "/{proposal_id}/supplier",
    response_model=ProjectProposalResponse,
    summary="Procurement fill supplier",
)
async def fill_project_proposal_supplier(
    proposal_id: int,
    data: ProjectProposalSupplierFill,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.fill_supplier(tenant_id, proposal_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{proposal_id}/submit", response_model=ProjectProposalResponse, summary="Submit")
async def submit_project_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, proposal_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{proposal_id}/approve", response_model=ProjectProposalResponse, summary="Approve")
async def approve_project_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, proposal_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{proposal_id}/reject", response_model=ProjectProposalResponse, summary="Reject")
async def reject_project_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, proposal_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{proposal_id}/issue",
    response_model=ProjectProposalResponse,
    summary="Issue to R&D",
)
async def issue_project_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.issue(tenant_id, proposal_id, current_user)
    except Exception as e:
        raise _http(e)


@router.delete(
    "/{proposal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete draft",
)
async def delete_project_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:project-proposal:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, proposal_id, current_user)
    except Exception as e:
        raise _http(e)
