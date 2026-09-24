"""节日福利发放 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.welfare import (
    WelfareBatchCreate,
    WelfareBatchLineUpdate,
    WelfareBatchUpdate,
)
from apps.kuaioa.services.welfare_service import WelfareBatchService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/welfare", tags=["App - Kuaioa - Welfare"])
svc = WelfareBatchService()


def _http(exc: Exception):
    if isinstance(exc, NotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(exc)})
    if isinstance(exc, BusinessLogicError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(exc)})
    raise exc


@router.get("/batches")
async def list_batches(
    keyword: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    festival_type: Optional[str] = Query(None),
    workshop_name: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:welfare:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await svc.list_batches(
        tenant_id,
        keyword=keyword,
        year=year,
        festival_type=festival_type,
        workshop_name=workshop_name,
        status=status_filter,
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/batches/{batch_id}")
async def get_batch(
    batch_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:welfare:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await svc.get_batch(tenant_id, batch_id), "success": True}
    except Exception as e:
        _http(e)


@router.post("/batches", status_code=status.HTTP_201_CREATED)
async def create_batch(
    data: WelfareBatchCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:welfare:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.create_batch(tenant_id, data, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.put("/batches/{batch_id}")
async def update_batch(
    data: WelfareBatchUpdate,
    batch_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:welfare:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.update_batch(tenant_id, batch_id, data, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.delete("/batches/{batch_id}")
async def delete_batch(
    batch_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:welfare:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await svc.delete_batch(tenant_id, batch_id, current_user.id)
        return {"success": True}
    except Exception as e:
        _http(e)


@router.post("/batches/{batch_id}/rebuild")
async def rebuild_batch(
    batch_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:welfare:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.rebuild_lines(tenant_id, batch_id, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.put("/batches/{batch_id}/lines/{line_id}")
async def update_line(
    data: WelfareBatchLineUpdate,
    batch_id: int = Path(..., ge=1),
    line_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:welfare:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.update_line(
                tenant_id, batch_id, line_id, data, current_user.id
            ),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.post("/batches/{batch_id}/confirm")
async def confirm_batch(
    batch_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:welfare:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.confirm(tenant_id, batch_id, current_user),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.post("/batches/{batch_id}/reopen")
async def reopen_batch(
    batch_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:welfare:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.reopen(tenant_id, batch_id, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)
