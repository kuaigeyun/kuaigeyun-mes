"""物料评审 API（R-15 #37）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.material_review import (
    MaterialReviewCreate,
    MaterialReviewListResponse,
    MaterialReviewResponse,
    MaterialReviewUpdate,
)
from apps.kuaiplm.services.material_review_service import MaterialReviewService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/material-reviews", tags=["App - Kuaiplm - Material Review"])
service = MaterialReviewService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("", response_model=MaterialReviewListResponse, summary="List material reviews")
async def list_material_reviews(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[int] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:material-review:read")),
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
    response_model=MaterialReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create material review",
)
async def create_material_review(
    data: MaterialReviewCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:material-review:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get("/{review_id}", response_model=MaterialReviewResponse, summary="Get material review")
async def get_material_review(
    review_id: int,
    _auth=Depends(require_permission_codes("kuaiplm:material-review:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, review_id)
    except Exception as e:
        raise _http(e)


@router.put("/{review_id}", response_model=MaterialReviewResponse, summary="Update material review")
async def update_material_review(
    review_id: int,
    data: MaterialReviewUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:material-review:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, review_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{review_id}/submit", response_model=MaterialReviewResponse, summary="Submit")
async def submit_material_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:material-review:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, review_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{review_id}/approve", response_model=MaterialReviewResponse, summary="Approve")
async def approve_material_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:material-review:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, review_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{review_id}/reject", response_model=MaterialReviewResponse, summary="Reject")
async def reject_material_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:material-review:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, review_id, current_user)
    except Exception as e:
        raise _http(e)


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete draft",
)
async def delete_material_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:material-review:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, review_id, current_user)
    except Exception as e:
        raise _http(e)
