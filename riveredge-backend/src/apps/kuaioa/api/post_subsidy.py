"""岗位补贴 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.post_subsidy import PostSubsidyCreate, PostSubsidyUpdate
from apps.kuaioa.services.post_subsidy_service import PostSubsidyService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/post-subsidies", tags=["App - Kuaioa - Post Subsidy"])
svc = PostSubsidyService()


@router.get("")
async def list_post_subsidies(
    keyword: Optional[str] = Query(None),
    year_month: Optional[str] = Query(None),
    workshop_name: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:post-subsidy:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await svc.list_rows(
        tenant_id, keyword=keyword, year_month=year_month, workshop_name=workshop_name
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/{row_id}")
async def get_post_subsidy(
    row_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:post-subsidy:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await svc.get_row(tenant_id, row_id), "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post_subsidy(
    data: PostSubsidyCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:post-subsidy:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.create_row(tenant_id, data, current_user.id),
            "success": True,
        }
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.put("/{row_id}")
async def update_post_subsidy(
    data: PostSubsidyUpdate,
    row_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:post-subsidy:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.update_row(tenant_id, row_id, data, current_user.id),
            "success": True,
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.delete("/{row_id}")
async def delete_post_subsidy(
    row_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:post-subsidy:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await svc.delete_row(tenant_id, row_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
