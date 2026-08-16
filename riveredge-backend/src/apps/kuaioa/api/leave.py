"""请假出差 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.leave import LeaveRequestCreate, LeaveRequestUpdate
from apps.kuaioa.services.leave_service import LeaveRequestService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/leave", tags=["App - Kuaioa - Leave"])
service = LeaveRequestService()


@router.get("/requests", summary="List leave requests")
async def list_leave_requests(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.leave", "read", required_permissions=["kuaioa:leave:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_requests(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/requests/{request_id}", summary="Get leave request")
async def get_leave_request(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.leave", "read", required_permissions=["kuaioa:leave:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.get_request(tenant_id, request_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/requests", status_code=status.HTTP_201_CREATED, summary="Create leave request")
async def create_leave_request(
    data: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.leave", "create", required_permissions=["kuaioa:leave:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/requests/{request_id}", summary="Update leave request")
async def update_leave_request(
    data: LeaveRequestUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.leave", "update", required_permissions=["kuaioa:leave:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.update_request(tenant_id, request_id, data, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.delete("/requests/{request_id}", summary="Delete leave request")
async def delete_leave_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.leave", "delete", required_permissions=["kuaioa:leave:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/requests/{request_id}/submit", summary="Submit leave request")
async def submit_leave_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.leave", "submit", required_permissions=["kuaioa:leave:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.submit_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/requests/{request_id}/revoke", summary="Revoke leave request")
async def revoke_leave_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.leave", "revoke", required_permissions=["kuaioa:leave:revoke"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.revoke_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})
