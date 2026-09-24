"""BOM 协同 API（R-15 #65）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaiplm.schemas.bom_collaboration import (
    BomCollabCreate,
    BomCollabEnter,
    BomCollabFormProfile,
    BomCollabListResponse,
    BomCollabResponse,
    BomCollabSectionUpdate,
    BomCollabUpdate,
)
from apps.kuaiplm.services.bom_collaboration_service import BomCollaborationService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/bom-collaborations", tags=["App - Kuaiplm - BOM Collaboration"])
service = BomCollaborationService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/meta/form-profile",
    response_model=BomCollabFormProfile,
    summary="BOM collab form profile (section labels)",
)
async def get_bom_collab_form_profile(
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_form_profile(tenant_id)
    except Exception as e:
        raise _http(e)


@router.get("", response_model=BomCollabListResponse, summary="List BOM collaborations")
async def list_bom_collaborations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[int] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:read")),
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
    response_model=BomCollabResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create BOM collaboration",
)
async def create_bom_collaboration(
    data: BomCollabCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get("/{collab_id}", response_model=BomCollabResponse, summary="Get BOM collaboration")
async def get_bom_collaboration(
    collab_id: int,
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, collab_id)
    except Exception as e:
        raise _http(e)


@router.put("/{collab_id}", response_model=BomCollabResponse, summary="Update header")
async def update_bom_collaboration(
    collab_id: int,
    data: BomCollabUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, collab_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.put(
    "/{collab_id}/sections/{section}",
    response_model=BomCollabResponse,
    summary="Replace one section lines (parallel-safe)",
)
async def update_bom_collaboration_section(
    collab_id: int,
    data: BomCollabSectionUpdate,
    section: str = Path(..., description="electronics | structure"),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_section(tenant_id, collab_id, section, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{collab_id}/submit", response_model=BomCollabResponse, summary="Submit")
async def submit_bom_collaboration(
    collab_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, collab_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{collab_id}/approve", response_model=BomCollabResponse, summary="Approve")
async def approve_bom_collaboration(
    collab_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, collab_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{collab_id}/reject", response_model=BomCollabResponse, summary="Reject")
async def reject_bom_collaboration(
    collab_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, collab_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{collab_id}/enter",
    response_model=BomCollabResponse,
    summary="Clerk enter master BOM reference",
)
async def enter_bom_collaboration(
    collab_id: int,
    data: BomCollabEnter,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.enter(tenant_id, collab_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.delete("/{collab_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete draft")
async def delete_bom_collaboration(
    collab_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:bom-collab:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, collab_id, current_user)
    except Exception as e:
        raise _http(e)
