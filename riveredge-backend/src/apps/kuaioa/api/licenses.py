"""证照台账 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.license import LicenseCreate, LicenseUpdate
from apps.kuaioa.services.license_service import LicenseRegistryService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/licenses", tags=["App - Kuaioa - Licenses"])
service = LicenseRegistryService()


@router.get("", summary="List compliance licenses")
async def list_licenses(
    keyword: Optional[str] = Query(None),
    license_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.license", "read", required_permissions=["kuaioa:license:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_licenses(
        tenant_id, keyword=keyword, license_type=license_type, status=status_filter
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/expiring", summary="List expiring licenses")
async def list_expiring_licenses(
    within_days: int = Query(30, ge=1, le=365),
    _auth=Depends(require_access("kuaioa.license", "read", required_permissions=["kuaioa:license:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_expiring(tenant_id, within_days=within_days)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/{license_id}", summary="Get license")
async def get_license(
    license_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.license", "read", required_permissions=["kuaioa:license:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.get_license(tenant_id, license_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create license")
async def create_license(
    data: LicenseCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.license", "create", required_permissions=["kuaioa:license:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await service.create_license(tenant_id, data, current_user.id)
    return {"data": row, "success": True}


@router.put("/{license_id}", summary="Update license")
async def update_license(
    data: LicenseUpdate,
    license_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.license", "update", required_permissions=["kuaioa:license:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.update_license(tenant_id, license_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.delete("/{license_id}", summary="Delete license")
async def delete_license(
    license_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.license", "delete", required_permissions=["kuaioa:license:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_license(tenant_id, license_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
