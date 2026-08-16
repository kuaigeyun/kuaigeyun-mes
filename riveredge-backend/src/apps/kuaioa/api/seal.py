"""用章申请 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.seal import SealRequestCreate, SealRequestUpdate
from apps.kuaioa.services.seal_service import SealRequestService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/seal", tags=["App - Kuaioa - Seal"])
service = SealRequestService()


@router.get("/requests", summary="List seal requests")
async def list_seal_requests(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.seal", "read", required_permissions=["kuaioa:seal:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_requests(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/requests/{request_id}", summary="Get seal request")
async def get_seal_request(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.seal", "read", required_permissions=["kuaioa:seal:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.get_request(tenant_id, request_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/requests", status_code=status.HTTP_201_CREATED, summary="Create seal request")
async def create_seal_request(
    data: SealRequestCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.seal", "create", required_permissions=["kuaioa:seal:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/requests/{request_id}", summary="Update seal request")
async def update_seal_request(
    data: SealRequestUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.seal", "update", required_permissions=["kuaioa:seal:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.update_request(tenant_id, request_id, data, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.delete("/requests/{request_id}", summary="Delete seal request")
async def delete_seal_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.seal", "delete", required_permissions=["kuaioa:seal:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/requests/{request_id}/submit", summary="Submit seal request")
async def submit_seal_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.seal", "submit", required_permissions=["kuaioa:seal:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.submit_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/requests/{request_id}/revoke", summary="Revoke seal request")
async def revoke_seal_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.seal", "revoke", required_permissions=["kuaioa:seal:revoke"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.revoke_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})
