"""样机制作书 API（研发项目 §2.15）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaiplm.schemas.prototype_build_sheet import (
    PrototypeBuildSectionUpdate,
    PrototypeBuildSheetCreate,
    PrototypeBuildSheetListResponse,
    PrototypeBuildSheetResponse,
    PrototypeBuildSheetUpdate,
    PrototypeBuildSignoffUpdate,
)
from apps.kuaiplm.services.prototype_build_sheet_service import PrototypeBuildSheetService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/prototype-build-sheets",
    tags=["App - Kuaiplm - Prototype Build Sheet"],
)
service = PrototypeBuildSheetService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("", response_model=PrototypeBuildSheetListResponse, summary="List prototype build sheets")
async def list_prototype_build_sheets(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[int] = Query(None),
    round_key: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            project_id=project_id,
            round_key=round_key,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise _http(e)


@router.post(
    "",
    response_model=PrototypeBuildSheetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create prototype build sheet",
)
async def create_prototype_build_sheet(
    data: PrototypeBuildSheetCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get(
    "/{sheet_id}",
    response_model=PrototypeBuildSheetResponse,
    summary="Get prototype build sheet",
)
async def get_prototype_build_sheet(
    sheet_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, sheet_id)
    except Exception as e:
        raise _http(e)


@router.put(
    "/{sheet_id}",
    response_model=PrototypeBuildSheetResponse,
    summary="Update project section",
)
async def update_prototype_build_sheet(
    data: PrototypeBuildSheetUpdate,
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, sheet_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.put(
    "/{sheet_id}/sections/{section}",
    response_model=PrototypeBuildSheetResponse,
    summary="Update electronics/structure section",
)
async def update_prototype_build_section(
    data: PrototypeBuildSectionUpdate,
    sheet_id: int = Path(..., ge=1),
    section: str = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_section(tenant_id, sheet_id, section, data, current_user)
    except Exception as e:
        raise _http(e)


@router.put(
    "/{sheet_id}/signoff",
    response_model=PrototypeBuildSheetResponse,
    summary="Update manufacturing/quality signoff opinions",
)
async def update_prototype_build_signoff(
    data: PrototypeBuildSignoffUpdate,
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_signoff(tenant_id, sheet_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{sheet_id}/submit",
    response_model=PrototypeBuildSheetResponse,
    summary="Submit prototype build sheet",
)
async def submit_prototype_build_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, sheet_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{sheet_id}/approve",
    response_model=PrototypeBuildSheetResponse,
    summary="Approve prototype build sheet",
)
async def approve_prototype_build_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, sheet_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{sheet_id}/reject",
    response_model=PrototypeBuildSheetResponse,
    summary="Reject prototype build sheet",
)
async def reject_prototype_build_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, sheet_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{sheet_id}/issue",
    response_model=PrototypeBuildSheetResponse,
    summary="Issue to manufacturing sample team",
)
async def issue_prototype_build_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.issue(tenant_id, sheet_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post(
    "/{sheet_id}/close",
    response_model=PrototypeBuildSheetResponse,
    summary="Close after manufacturing/quality signoff",
)
async def close_prototype_build_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:complete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.close(tenant_id, sheet_id, current_user)
    except Exception as e:
        raise _http(e)


@router.delete(
    "/{sheet_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete draft prototype build sheet",
)
async def delete_prototype_build_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:prototype-build-sheet:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, sheet_id, current_user)
    except Exception as e:
        raise _http(e)
