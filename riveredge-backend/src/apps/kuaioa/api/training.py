"""培训与上岗证 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.training import (
    TrainingPlanCreate,
    TrainingPlanUpdate,
    TrainingRecordCreate,
    TrainingRecordUpdate,
    WorkLicenseCreate,
    WorkLicenseUpdate,
)
from apps.kuaioa.services.training_service import (
    TrainingPlanService,
    TrainingRecordService,
    WorkLicenseService,
)
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/training", tags=["App - Kuaioa - Training"])
plan_service = TrainingPlanService()
record_service = TrainingRecordService()
license_service = WorkLicenseService()


@router.get("/plans", summary="List training plans")
async def list_training_plans(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.training-plan", "read", required_permissions=["kuaioa:training-plan:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await plan_service.list_plans(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/plans", status_code=status.HTTP_201_CREATED, summary="Create training plan")
async def create_training_plan(
    data: TrainingPlanCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.training-plan", "create", required_permissions=["kuaioa:training-plan:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await plan_service.create_plan(tenant_id, data, current_user.id)
    return {"data": row, "success": True}


@router.put("/plans/{plan_id}", summary="Update training plan")
async def update_training_plan(
    data: TrainingPlanUpdate,
    plan_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.training-plan", "update", required_permissions=["kuaioa:training-plan:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await plan_service.update_plan(tenant_id, plan_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.delete("/plans/{plan_id}", summary="Delete training plan")
async def delete_training_plan(
    plan_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.training-plan", "delete", required_permissions=["kuaioa:training-plan:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await plan_service.delete_plan(tenant_id, plan_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.get("/records", summary="List training records")
async def list_training_records(
    keyword: Optional[str] = Query(None),
    plan_id: Optional[int] = Query(None),
    _auth=Depends(require_access("kuaioa.training-record", "read", required_permissions=["kuaioa:training-record:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await record_service.list_records(tenant_id, keyword=keyword, plan_id=plan_id)
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/records", status_code=status.HTTP_201_CREATED, summary="Create training record")
async def create_training_record(
    data: TrainingRecordCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.training-record", "create", required_permissions=["kuaioa:training-record:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await record_service.create_record(tenant_id, data, current_user.id)
    return {"data": row, "success": True}


@router.put("/records/{record_id}", summary="Update training record")
async def update_training_record(
    data: TrainingRecordUpdate,
    record_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.training-record", "update", required_permissions=["kuaioa:training-record:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await record_service.update_record(tenant_id, record_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.delete("/records/{record_id}", summary="Delete training record")
async def delete_training_record(
    record_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.training-record", "delete", required_permissions=["kuaioa:training-record:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await record_service.delete_record(tenant_id, record_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.get("/work-licenses", summary="List work licenses")
async def list_work_licenses(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.work-license", "read", required_permissions=["kuaioa:work-license:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await license_service.list_licenses(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/work-licenses/expiring", summary="List expiring work licenses")
async def list_expiring_work_licenses(
    within_days: int = Query(30, ge=1, le=365),
    _auth=Depends(require_access("kuaioa.work-license", "read", required_permissions=["kuaioa:work-license:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await license_service.list_expiring(tenant_id, within_days=within_days)
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/work-licenses", status_code=status.HTTP_201_CREATED, summary="Create work license")
async def create_work_license(
    data: WorkLicenseCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.work-license", "create", required_permissions=["kuaioa:work-license:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await license_service.create_license(tenant_id, data, current_user.id)
    return {"data": row, "success": True}


@router.put("/work-licenses/{license_id}", summary="Update work license")
async def update_work_license(
    data: WorkLicenseUpdate,
    license_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.work-license", "update", required_permissions=["kuaioa:work-license:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await license_service.update_license(tenant_id, license_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.delete("/work-licenses/{license_id}", summary="Delete work license")
async def delete_work_license(
    license_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.work-license", "delete", required_permissions=["kuaioa:work-license:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await license_service.delete_license(tenant_id, license_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
