"""公告通知 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.announcement import AnnouncementCreate, AnnouncementUpdate
from apps.kuaioa.services.announcement_service import AnnouncementService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/announcements", tags=["App - Kuaioa - Announcements"])
service = AnnouncementService()


@router.get("", summary="List announcements")
async def list_announcements(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    published_only: bool = Query(False),
    _auth=Depends(require_access("kuaioa.announcement", "read", required_permissions=["kuaioa:announcement:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_announcements(
        tenant_id, keyword=keyword, status=status_filter, published_only=published_only
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/{announcement_id}", summary="Get announcement")
async def get_announcement(
    announcement_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.announcement", "read", required_permissions=["kuaioa:announcement:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.get_announcement(tenant_id, announcement_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create announcement")
async def create_announcement(
    data: AnnouncementCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.announcement", "create", required_permissions=["kuaioa:announcement:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await service.create_announcement(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/{announcement_id}", summary="Update announcement")
async def update_announcement(
    data: AnnouncementUpdate,
    announcement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.announcement", "update", required_permissions=["kuaioa:announcement:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.update_announcement(tenant_id, announcement_id, data, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.delete("/{announcement_id}", summary="Delete announcement")
async def delete_announcement(
    announcement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.announcement", "delete", required_permissions=["kuaioa:announcement:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_announcement(tenant_id, announcement_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/{announcement_id}/publish", summary="Publish announcement")
async def publish_announcement(
    announcement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.announcement", "publish", required_permissions=["kuaioa:announcement:publish"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.publish_announcement(tenant_id, announcement_id, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})
