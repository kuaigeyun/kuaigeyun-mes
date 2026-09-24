"""员工档案 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.employee import EmployeeProfileCreate, EmployeeProfileUpdate
from apps.kuaioa.services.employee_service import EmployeeProfileService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/employees", tags=["App - Kuaioa - Employees"])
service = EmployeeProfileService()


@router.get("", summary="List employee profiles")
async def list_employees(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    employment_type: Optional[str] = Query(None),
    workshop_name: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:employee:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_profiles(
        tenant_id,
        keyword=keyword,
        status=status_filter,
        employment_type=employment_type,
        workshop_name=workshop_name,
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/movements", summary="List hire/leave movements in month")
async def list_employee_movements(
    year_month: str = Query(..., min_length=7, max_length=7),
    workshop_name: Optional[str] = Query(None),
    movement_type: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:employee:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        rows = await service.list_movements(
            tenant_id,
            year_month,
            workshop_name=workshop_name,
            movement_type=movement_type,
        )
        return {"data": rows, "total": len(rows), "success": True}
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.get("/{profile_id}", summary="Get employee profile")
async def get_employee(
    profile_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:employee:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.get_profile(tenant_id, profile_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create employee profile")
async def create_employee(
    data: EmployeeProfileCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:employee:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.create_profile(tenant_id, data, current_user.id)
        return {"data": row, "success": True}
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.put("/{profile_id}", summary="Update employee profile")
async def update_employee(
    data: EmployeeProfileUpdate,
    profile_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:employee:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.update_profile(tenant_id, profile_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.delete("/{profile_id}", summary="Delete employee profile")
async def delete_employee(
    profile_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:employee:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_profile(tenant_id, profile_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
