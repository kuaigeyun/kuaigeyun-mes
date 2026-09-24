"""生产文件中心 API（R-06）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.production_file import (
    ProductionFileAccessLogListResponse,
    ProductionFileAccessLogResponse,
    ProductionFileAccessRequest,
    ProductionFileCreate,
    ProductionFileDownloadResponse,
    ProductionFileIssueRequest,
    ProductionFileListResponse,
    ProductionFileResponse,
    ProductionFileReviseRequest,
    ProductionFileUpdate,
    ProductionFileVersionListResponse,
)
from apps.kuaiplm.services.production_file_service import ProductionFileService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.authorization.user_permission_service import UserPermissionService
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/production-files", tags=["App - Kuaiplm - Production File"])
service = ProductionFileService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def _permission_codes(user: User, tenant_id: int) -> list[str]:
    return sorted(
        await UserPermissionService.get_user_permissions(
            user_id=user.id,
            tenant_id=tenant_id,
        )
    )


@router.get("", response_model=ProductionFileListResponse, summary="List production files")
async def list_production_files(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    catalog_kind: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    process_code: Optional[str] = Query(None),
    product_model: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    production_view: bool = Query(False, description="生产使用视图：仅现行生效版"),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            catalog_kind=catalog_kind,
            file_type=file_type,
            process_code=process_code,
            product_model=product_model,
            project_id=project_id,
            production_view=production_view,
            current_user_id=current_user.id,
            permission_codes=codes,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise _http(e)


@router.post(
    "",
    response_model=ProductionFileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create production file",
)
async def create_production_file(
    data: ProductionFileCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get("/{file_id}", response_model=ProductionFileResponse, summary="Get production file")
async def get_production_file(
    file_id: int,
    _auth=Depends(require_permission_codes("kuaiplm:production-file:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, file_id)
    except Exception as e:
        raise _http(e)


@router.put("/{file_id}", response_model=ProductionFileResponse, summary="Update production file")
async def update_production_file(
    file_id: int,
    data: ProductionFileUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, file_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{file_id}/submit", response_model=ProductionFileResponse, summary="Submit")
async def submit_production_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, file_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{file_id}/approve", response_model=ProductionFileResponse, summary="Approve")
async def approve_production_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, file_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{file_id}/reject", response_model=ProductionFileResponse, summary="Reject")
async def reject_production_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, file_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{file_id}/revise", response_model=ProductionFileResponse, summary="Revise")
async def revise_production_file(
    file_id: int,
    data: ProductionFileReviseRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.revise(tenant_id, file_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{file_id}/obsolete", response_model=ProductionFileResponse, summary="Obsolete")
async def obsolete_production_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:obsolete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.obsolete(tenant_id, file_id, current_user)
    except Exception as e:
        raise _http(e)


@router.get(
    "/{file_id}/download",
    response_model=ProductionFileDownloadResponse,
    summary="Download production file",
)
async def download_production_file(
    file_id: int,
    version_id: Optional[int] = Query(None),
    production_view: bool = Query(False, description="生产使用视图"),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.resolve_download(
            tenant_id,
            file_id,
            current_user,
            version_id=version_id,
            permission_codes=codes,
            production_view=production_view,
        )
    except Exception as e:
        raise _http(e)


@router.post("/{file_id}/issue", response_model=ProductionFileResponse, summary="Issue")
async def issue_production_file(
    file_id: int,
    data: ProductionFileIssueRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.issue(
            tenant_id, file_id, data, current_user, permission_codes=codes
        )
    except Exception as e:
        raise _http(e)


@router.post(
    "/{file_id}/access",
    response_model=ProductionFileAccessLogResponse,
    summary="Record view/download",
)
async def record_production_file_access(
    file_id: int,
    data: ProductionFileAccessRequest,
    current_user: User = Depends(get_current_user),
    production_view: bool = Query(False),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.record_access(
            tenant_id,
            file_id,
            data,
            current_user,
            permission_codes=codes,
            production_view=production_view,
        )
    except Exception as e:
        raise _http(e)


@router.get(
    "/{file_id}/versions",
    response_model=ProductionFileVersionListResponse,
    summary="List versions (INF-05 filtered)",
)
async def list_production_file_versions(
    file_id: int,
    production_view: bool = Query(False),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.list_versions(
            tenant_id,
            file_id,
            current_user_id=current_user.id,
            permission_codes=codes,
            production_view=production_view,
        )
    except Exception as e:
        raise _http(e)


@router.get(
    "/{file_id}/access-logs",
    response_model=ProductionFileAccessLogListResponse,
    summary="List access logs",
)
async def list_production_file_access_logs(
    file_id: int,
    action: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list_access_logs(
            tenant_id, file_id, action=action, skip=skip, limit=limit
        )
    except Exception as e:
        raise _http(e)


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete draft",
)
async def delete_production_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:production-file:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, file_id, current_user)
    except Exception as e:
        raise _http(e)
