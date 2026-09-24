"""培训与上岗证 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.training import (
    DeptTrainingApplicationCreate,
    DeptTrainingApplicationUpdate,
    SpecialWorkQualificationCreate,
    SpecialWorkQualificationUpdate,
    TrainingPlanCreate,
    TrainingPlanUpdate,
    TrainingRecordCreate,
    TrainingRecordUpdate,
    TrainingTemplateCreate,
    TrainingTemplateUpdate,
    WorkLicenseCreate,
    WorkLicenseUpdate,
)
from apps.kuaioa.services.training_service import (
    TrainingPlanService,
    TrainingRecordService,
    TrainingTemplateService,
    WorkLicenseService,
)
from apps.kuaioa.services.training_workflow_service import (
    DeptTrainingApplicationService,
    SpecialWorkQualificationService,
)
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/training", tags=["App - Kuaioa - Training"])
plan_service = TrainingPlanService()
record_service = TrainingRecordService()
license_service = WorkLicenseService()
template_service = TrainingTemplateService()
dept_app_service = DeptTrainingApplicationService()
special_work_service = SpecialWorkQualificationService()


def _http_error(exc: Exception) -> HTTPException:
    code = (
        status.HTTP_404_NOT_FOUND
        if isinstance(exc, NotFoundError)
        else status.HTTP_409_CONFLICT
    )
    return HTTPException(status_code=code, detail={"message": str(exc)})


# ---------- 年度培训计划 ----------


@router.get("/plans", summary="List training plans")
async def list_training_plans(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:training-plan:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await plan_service.list_plans(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/plans/{plan_id}", summary="Get training plan")
async def get_training_plan(
    plan_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:training-plan:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await plan_service.get_plan(tenant_id, plan_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.post("/plans", status_code=status.HTTP_201_CREATED, summary="Create training plan")
async def create_training_plan(
    data: TrainingPlanCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-plan:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await plan_service.create_plan(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/plans/{plan_id}", summary="Update training plan")
async def update_training_plan(
    data: TrainingPlanUpdate,
    plan_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-plan:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await plan_service.update_plan(tenant_id, plan_id, data, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete("/plans/{plan_id}", summary="Delete training plan")
async def delete_training_plan(
    plan_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-plan:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await plan_service.delete_plan(tenant_id, plan_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/plans/{plan_id}/submit", summary="Submit training plan")
async def submit_training_plan(
    plan_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-plan:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await plan_service.submit_plan(tenant_id, plan_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/plans/{plan_id}/revoke", summary="Revoke training plan")
async def revoke_training_plan(
    plan_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-plan:revoke")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await plan_service.revoke_plan(tenant_id, plan_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


# ---------- 培训记录 ----------


@router.get("/records", summary="List training records")
async def list_training_records(
    keyword: Optional[str] = Query(None),
    plan_id: Optional[int] = Query(None),
    record_kind: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:training-record:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await record_service.list_records(
        tenant_id, keyword=keyword, plan_id=plan_id, record_kind=record_kind
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/records/{record_id}", summary="Get training record")
async def get_training_record(
    record_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:training-record:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await record_service.get_record(tenant_id, record_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.post("/records", status_code=status.HTTP_201_CREATED, summary="Create training record")
async def create_training_record(
    data: TrainingRecordCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-record:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await record_service.create_record(tenant_id, data, current_user.id)
    return {"data": row, "success": True}


@router.put("/records/{record_id}", summary="Update training record")
async def update_training_record(
    data: TrainingRecordUpdate,
    record_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-record:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await record_service.update_record(tenant_id, record_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.post("/records/{record_id}/confirm-hr", summary="HR confirm training content")
async def confirm_training_record_hr(
    record_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-record:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await record_service.confirm_hr(tenant_id, record_id, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete("/records/{record_id}", summary="Delete training record")
async def delete_training_record(
    record_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-record:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await record_service.delete_record(tenant_id, record_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise _http_error(e)


# ---------- 上岗证 ----------


@router.get("/work-licenses", summary="List work licenses")
async def list_work_licenses(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:work-license:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await license_service.list_licenses(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/work-licenses/expiring", summary="List expiring work licenses")
async def list_expiring_work_licenses(
    within_days: int = Query(30, ge=1, le=365),
    _auth=Depends(require_permission_codes("kuaioa:work-license:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await license_service.list_expiring(tenant_id, within_days=within_days)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/work-licenses/{license_id}", summary="Get work license")
async def get_work_license(
    license_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:work-license:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await license_service.get_license(tenant_id, license_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.post("/work-licenses", status_code=status.HTTP_201_CREATED, summary="Create work license")
async def create_work_license(
    data: WorkLicenseCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:work-license:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await license_service.create_license(tenant_id, data, current_user.id)
    return {"data": row, "success": True}


@router.put("/work-licenses/{license_id}", summary="Update work license")
async def update_work_license(
    data: WorkLicenseUpdate,
    license_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:work-license:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await license_service.update_license(tenant_id, license_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.delete("/work-licenses/{license_id}", summary="Delete work license")
async def delete_work_license(
    license_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:work-license:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await license_service.delete_license(tenant_id, license_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.get("/work-licenses/{license_id}/print", summary="Print work license payload")
async def print_work_license(
    license_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:work-license:print")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        payload = await license_service.build_print_payload(tenant_id, license_id)
        return {"data": payload, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


# ---------- 部门培训申请 ----------


@router.get("/dept-applications", summary="List department training applications")
async def list_dept_applications(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:dept-training-application:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await dept_app_service.list_requests(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/dept-applications/{request_id}", summary="Get department training application")
async def get_dept_application(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:dept-training-application:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await dept_app_service.get_request(tenant_id, request_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.post(
    "/dept-applications",
    status_code=status.HTTP_201_CREATED,
    summary="Create department training application",
)
async def create_dept_application(
    data: DeptTrainingApplicationCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:dept-training-application:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await dept_app_service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/dept-applications/{request_id}", summary="Update department training application")
async def update_dept_application(
    data: DeptTrainingApplicationUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:dept-training-application:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await dept_app_service.update_request(tenant_id, request_id, data, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete("/dept-applications/{request_id}", summary="Delete department training application")
async def delete_dept_application(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:dept-training-application:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await dept_app_service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/dept-applications/{request_id}/submit", summary="Submit department training application")
async def submit_dept_application(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:dept-training-application:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await dept_app_service.submit_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/dept-applications/{request_id}/revoke", summary="Revoke department training application")
async def revoke_dept_application(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:dept-training-application:revoke")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await dept_app_service.revoke_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


# ---------- 特殊作业资格 ----------


@router.get("/special-work-qualifications", summary="List special work qualifications")
async def list_special_work(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:special-work-qualification:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await special_work_service.list_requests(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/special-work-qualifications/{request_id}", summary="Get special work qualification")
async def get_special_work(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:special-work-qualification:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await special_work_service.get_request(tenant_id, request_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.post(
    "/special-work-qualifications",
    status_code=status.HTTP_201_CREATED,
    summary="Create special work qualification",
)
async def create_special_work(
    data: SpecialWorkQualificationCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:special-work-qualification:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await special_work_service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/special-work-qualifications/{request_id}", summary="Update special work qualification")
async def update_special_work(
    data: SpecialWorkQualificationUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:special-work-qualification:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await special_work_service.update_request(tenant_id, request_id, data, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete(
    "/special-work-qualifications/{request_id}",
    summary="Delete special work qualification",
)
async def delete_special_work(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:special-work-qualification:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await special_work_service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post(
    "/special-work-qualifications/{request_id}/submit",
    summary="Submit special work qualification",
)
async def submit_special_work(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:special-work-qualification:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await special_work_service.submit_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post(
    "/special-work-qualifications/{request_id}/revoke",
    summary="Revoke special work qualification",
)
async def revoke_special_work(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:special-work-qualification:revoke")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await special_work_service.revoke_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


# ---------- 培训模板 ----------


@router.get("/templates", summary="List training templates")
async def list_training_templates(
    keyword: Optional[str] = Query(None),
    template_kind: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:training-template:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await template_service.list_templates(
        tenant_id, keyword=keyword, template_kind=template_kind
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/templates/{template_id}", summary="Get training template")
async def get_training_template(
    template_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:training-template:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.get_template(tenant_id, template_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise _http_error(e)


@router.post("/templates", status_code=status.HTTP_201_CREATED, summary="Create training template")
async def create_training_template(
    data: TrainingTemplateCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-template:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.create_template(tenant_id, data, current_user.id)
        return {"data": row, "success": True}
    except BusinessLogicError as e:
        raise _http_error(e)


@router.put("/templates/{template_id}", summary="Update training template")
async def update_training_template(
    data: TrainingTemplateUpdate,
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-template:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.update_template(
            tenant_id, template_id, data, current_user.id
        )
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete("/templates/{template_id}", summary="Delete training template")
async def delete_training_template(
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:training-template:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await template_service.delete_template(tenant_id, template_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise _http_error(e)
