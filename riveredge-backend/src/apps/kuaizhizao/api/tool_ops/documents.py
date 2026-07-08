"""
工装运营单据 API：领用、归还、校验、保养、维修、报废。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.tool import (
    ToolMaintenanceReminderResponse,
    ToolMaintenanceReminderListResponse,
    ToolCalibrationReminderResponse,
    ToolCalibrationReminderListResponse,
)
from apps.kuaizhizao.schemas.tool_ops import (
    ToolBorrowCreate,
    ToolBorrowUpdate,
    ToolBorrowResponse,
    ToolBorrowListResponse,
    ToolReturnCreate,
    ToolReturnUpdate,
    ToolReturnResponse,
    ToolReturnListResponse,
    ToolMaintenanceCreate,
    ToolMaintenanceUpdate,
    ToolMaintenanceResponse,
    ToolMaintenanceListResponse,
    ToolMaintenanceLineResponse,
    ToolMaintenancePreviewResponse,
    ToolMaintenanceReject,
    ToolRepairCreate,
    ToolRepairUpdate,
    ToolRepairResponse,
    ToolRepairListResponse,
    ToolRepairLineResponse,
    ToolRepairPreviewResponse,
    ToolRepairReject,
    ToolOpsCalibrationCreate,
    ToolOpsCalibrationUpdate,
    ToolOpsCalibrationResponse,
    ToolOpsCalibrationListResponse,
    ToolScrapApplicationCreate,
    ToolScrapApplicationUpdate,
    ToolScrapApplicationResponse,
    ToolScrapApplicationListResponse,
    ToolScrapApplicationReject,
)
from apps.kuaizhizao.services.tool_ops_service import ToolOpsService
from apps.kuaizhizao.services.tool_service import ToolMaintenanceReminderService

router = APIRouter()
svc = ToolOpsService()


def _http_from_exc(e: Exception) -> HTTPException:
    if isinstance(e, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _maintenance_response(header, lines=None) -> ToolMaintenanceResponse:
    resp = ToolMaintenanceResponse.model_validate(header)
    if lines is not None:
        resp.lines = [ToolMaintenanceLineResponse.model_validate(l) for l in lines]
    return resp


def _repair_response(header, lines=None) -> ToolRepairResponse:
    resp = ToolRepairResponse.model_validate(header)
    if lines is not None:
        resp.lines = [ToolRepairLineResponse.model_validate(l) for l in lines]
    return resp


# ---------- 领用 ----------

@router.post(
    "/tool-borrows",
    response_model=ToolBorrowResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-borrow:create"))],
)
async def create_tool_borrow(
    data: ToolBorrowCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.borrow_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        return ToolBorrowResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/tool-borrows/outstanding",
    response_model=ToolBorrowListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-borrow:read"))],
)
async def list_outstanding_tool_borrows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),

    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    doc_start_date: Optional[str] = Query(None, description="单据日期起"),
    doc_end_date: Optional[str] = Query(None, description="单据日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.borrow_service.list_outstanding(tenant_id, skip, limit, tool_id)
    return ToolBorrowListResponse(
        items=[ToolBorrowResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-borrows",
    response_model=ToolBorrowListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-borrow:read"))],
)
async def list_tool_borrows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),

    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    doc_start_date: Optional[str] = Query(None, description="单据日期起"),
    doc_end_date: Optional[str] = Query(None, description="单据日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.borrow_service.list(tenant_id, skip, limit, tool_id, status_filter,
        keyword=keyword,
        search=search,
        order_by=order_by,
        doc_start_date=doc_start_date,
        doc_end_date=doc_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return ToolBorrowListResponse(
        items=[ToolBorrowResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-borrows/{row_id}",
    response_model=ToolBorrowResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-borrow:read"))],
)
async def get_tool_borrow(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.borrow_service.get(tenant_id, row_id)
        return ToolBorrowResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/tool-borrows/{row_id}",
    response_model=ToolBorrowResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-borrow:update"))],
)
async def update_tool_borrow(
    row_id: int,
    data: ToolBorrowUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.borrow_service.update(tenant_id, row_id, data)
        return ToolBorrowResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/tool-borrows/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-borrow:delete"))],
)
async def delete_tool_borrow(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.borrow_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


# ---------- 归还 ----------

@router.post(
    "/tool-returns",
    response_model=ToolReturnResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-return:create"))],
)
async def create_tool_return(
    data: ToolReturnCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.return_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        return ToolReturnResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/tool-returns",
    response_model=ToolReturnListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-return:read"))],
)
async def list_tool_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),

    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    doc_start_date: Optional[str] = Query(None, description="单据日期起"),
    doc_end_date: Optional[str] = Query(None, description="单据日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.return_service.list(tenant_id, skip, limit, tool_id,
        keyword=keyword,
        search=search,
        order_by=order_by,
        doc_start_date=doc_start_date,
        doc_end_date=doc_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return ToolReturnListResponse(
        items=[ToolReturnResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-returns/{row_id}",
    response_model=ToolReturnResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-return:read"))],
)
async def get_tool_return(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.return_service.get(tenant_id, row_id)
        return ToolReturnResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/tool-returns/{row_id}",
    response_model=ToolReturnResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-return:update"))],
)
async def update_tool_return(
    row_id: int,
    data: ToolReturnUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.return_service.update(tenant_id, row_id, data)
        return ToolReturnResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/tool-returns/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-return:delete"))],
)
async def delete_tool_return(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.return_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


# ---------- 保养 ----------

@router.get(
    "/tool-maintenances/preview-lines",
    response_model=ToolMaintenancePreviewResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:read"))],
)
async def preview_tool_maintenance_lines(
    tool_id: int = Query(..., ge=1),
    scheme_id: Optional[int] = Query(None, ge=1),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await svc.maintenance_service.preview_lines(tenant_id, tool_id, scheme_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-maintenances",
    response_model=ToolMaintenanceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:create"))],
)
async def create_tool_maintenance(
    data: ToolMaintenanceCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.maintenance_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        lines = await svc.maintenance_service._load_lines(tenant_id, header.id)
        return _maintenance_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/tool-maintenances",
    response_model=ToolMaintenanceListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:read"))],
)
async def list_tool_maintenances(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),

    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    doc_start_date: Optional[str] = Query(None, description="单据日期起"),
    doc_end_date: Optional[str] = Query(None, description="单据日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.maintenance_service.list(tenant_id, skip, limit, tool_id, status_filter,
        keyword=keyword,
        search=search,
        order_by=order_by,
        doc_start_date=doc_start_date,
        doc_end_date=doc_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return ToolMaintenanceListResponse(
        items=[ToolMaintenanceResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-maintenances/{row_id}",
    response_model=ToolMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:read"))],
)
async def get_tool_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        header = await svc.maintenance_service.get(tenant_id, row_id)
        lines = await svc.maintenance_service._load_lines(tenant_id, header.id)
        return _maintenance_response(header, lines)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/tool-maintenances/{row_id}",
    response_model=ToolMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:update"))],
)
async def update_tool_maintenance(
    row_id: int,
    data: ToolMaintenanceUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.maintenance_service.update(tenant_id, row_id, data)
        lines = await svc.maintenance_service._load_lines(tenant_id, header.id)
        return _maintenance_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-maintenances/{row_id}/submit",
    response_model=ToolMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:submit"))],
)
async def submit_tool_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.maintenance_service.submit(tenant_id, row_id)
        return ToolMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-maintenances/{row_id}/approve",
    response_model=ToolMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:approve"))],
)
async def approve_tool_maintenance(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ToolMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-maintenances/{row_id}/reject",
    response_model=ToolMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:reject"))],
)
async def reject_tool_maintenance(
    row_id: int,
    body: ToolMaintenanceReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ToolMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-maintenances/{row_id}/complete",
    response_model=ToolMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:update"))],
)
async def complete_tool_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.maintenance_service.complete(tenant_id, row_id)
        return ToolMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/tool-maintenances/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance:delete"))],
)
async def delete_tool_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)




# ---------- 校验 ----------

@router.post(
    "/tool-calibrations",
    response_model=ToolOpsCalibrationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-calibration:create"))],
)
async def create_tool_calibration(
    data: ToolOpsCalibrationCreate,
    effective: bool = Query(False, description="创建并立即生效"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        if effective:
            row = await svc.calibration_service.create_effective(
                tenant_id,
                data,
                operator_id=current_user.id,
                operator_name=current_user.nickname or current_user.username,
            )
        else:
            row = await svc.calibration_service.create(
                tenant_id,
                data,
                operator_id=current_user.id,
                operator_name=current_user.nickname or current_user.username,
            )
        return ToolOpsCalibrationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/tool-calibrations",
    response_model=ToolOpsCalibrationListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-calibration:read"))],
)
async def list_tool_calibrations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),

    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    doc_start_date: Optional[str] = Query(None, description="单据日期起"),
    doc_end_date: Optional[str] = Query(None, description="单据日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.calibration_service.list(tenant_id, skip, limit, tool_id, status_filter,
        keyword=keyword,
        search=search,
        order_by=order_by,
        doc_start_date=doc_start_date,
        doc_end_date=doc_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return ToolOpsCalibrationListResponse(
        items=[ToolOpsCalibrationResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-calibrations/{row_id}",
    response_model=ToolOpsCalibrationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-calibration:read"))],
)
async def get_tool_calibration(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.calibration_service.get(tenant_id, row_id)
        return ToolOpsCalibrationResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/tool-calibrations/{row_id}",
    response_model=ToolOpsCalibrationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-calibration:update"))],
)
async def update_tool_calibration(
    row_id: int,
    data: ToolOpsCalibrationUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.calibration_service.update(tenant_id, row_id, data)
        return ToolOpsCalibrationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-calibrations/{row_id}/complete",
    response_model=ToolOpsCalibrationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-calibration:update"))],
)
async def complete_tool_calibration(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.calibration_service.complete(tenant_id, row_id)
        return ToolOpsCalibrationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/tool-calibrations/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-calibration:delete"))],
)
async def delete_tool_calibration(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.calibration_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


# ---------- 报废申请 ----------

@router.post(
    "/tool-scrap-applications",
    response_model=ToolScrapApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:create"))],
)
async def create_tool_scrap_application(
    data: ToolScrapApplicationCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        return ToolScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/tool-scrap-applications",
    response_model=ToolScrapApplicationListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:read"))],
)
async def list_tool_scrap_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),

    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    doc_start_date: Optional[str] = Query(None, description="单据日期起"),
    doc_end_date: Optional[str] = Query(None, description="单据日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.scrap_application_service.list(
        tenant_id, skip, limit, tool_id, status_filter
    ,

        keyword=keyword,
        search=search,
        order_by=order_by,
        doc_start_date=doc_start_date,
        doc_end_date=doc_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return ToolScrapApplicationListResponse(
        items=[ToolScrapApplicationResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-scrap-applications/{row_id}",
    response_model=ToolScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:read"))],
)
async def get_tool_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.scrap_application_service.get(tenant_id, row_id)
        return ToolScrapApplicationResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/tool-scrap-applications/{row_id}",
    response_model=ToolScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:update"))],
)
async def update_tool_scrap_application(
    row_id: int,
    data: ToolScrapApplicationUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.update(tenant_id, row_id, data)
        return ToolScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-scrap-applications/{row_id}/submit",
    response_model=ToolScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:submit"))],
)
async def submit_tool_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.scrap_application_service.submit(tenant_id, row_id)
        return ToolScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-scrap-applications/{row_id}/approve",
    response_model=ToolScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:approve"))],
)
async def approve_tool_scrap_application(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ToolScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-scrap-applications/{row_id}/reject",
    response_model=ToolScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:reject"))],
)
async def reject_tool_scrap_application(
    row_id: int,
    body: ToolScrapApplicationReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ToolScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/tool-scrap-applications/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-scrap:delete"))],
)
async def delete_tool_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.scrap_application_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)

# ---------- 维修 ----------

@router.get(
    "/tool-repairs/preview-lines",
    response_model=ToolRepairPreviewResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:read"))],
)
async def preview_tool_repair_lines(
    tool_id: int = Query(..., ge=1),
    scheme_id: Optional[int] = Query(None, ge=1),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await svc.repair_service.preview_lines(tenant_id, tool_id, scheme_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-repairs",
    response_model=ToolRepairResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:create"))],
)
async def create_tool_repair(
    data: ToolRepairCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.repair_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        lines = await svc.repair_service._load_lines(tenant_id, header.id)
        return _repair_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/tool-repairs",
    response_model=ToolRepairListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:read"))],
)
async def list_tool_repairs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),

    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    doc_start_date: Optional[str] = Query(None, description="单据日期起"),
    doc_end_date: Optional[str] = Query(None, description="单据日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.repair_service.list(tenant_id, skip, limit, tool_id, status_filter,
        keyword=keyword,
        search=search,
        order_by=order_by,
        doc_start_date=doc_start_date,
        doc_end_date=doc_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return ToolRepairListResponse(
        items=[ToolRepairResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-repairs/{row_id}",
    response_model=ToolRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:read"))],
)
async def get_tool_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        header = await svc.repair_service.get(tenant_id, row_id)
        lines = await svc.repair_service._load_lines(tenant_id, header.id)
        return _repair_response(header, lines)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/tool-repairs/{row_id}",
    response_model=ToolRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:update"))],
)
async def update_tool_repair(
    row_id: int,
    data: ToolRepairUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.repair_service.update(tenant_id, row_id, data)
        lines = await svc.repair_service._load_lines(tenant_id, header.id)
        return _repair_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-repairs/{row_id}/submit",
    response_model=ToolRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:submit"))],
)
async def submit_tool_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.repair_service.submit(tenant_id, row_id)
        return ToolRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-repairs/{row_id}/approve",
    response_model=ToolRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:approve"))],
)
async def approve_tool_repair(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ToolRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-repairs/{row_id}/reject",
    response_model=ToolRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:reject"))],
)
async def reject_tool_repair(
    row_id: int,
    body: ToolRepairReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ToolRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/tool-repairs/{row_id}/complete",
    response_model=ToolRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:update"))],
)
async def complete_tool_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.repair_service.complete(tenant_id, row_id)
        return ToolRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/tool-repairs/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-repair:delete"))],
)
async def delete_tool_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.repair_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/tool-maintenance-reminders",
    response_model=ToolMaintenanceReminderListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-reminder:read"))],
)
async def list_tool_maintenance_reminders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    reminder_type: Optional[str] = Query(None, description="due_soon/overdue"),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await ToolMaintenanceReminderService.list_reminders(
        tenant_id, skip, limit, reminder_type
    )
    return ToolMaintenanceReminderListResponse(
        items=[ToolMaintenanceReminderResponse.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/tool-calibration-reminders",
    response_model=ToolCalibrationReminderListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-reminder:read"))],
)
async def list_tool_calibration_reminders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    due_type: Optional[str] = Query(None, description="due_soon/overdue"),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.tool_service import ToolMaintenanceReminderService

    items, total = await ToolMaintenanceReminderService.list_calibration_alerts(
        tenant_id, skip, limit, due_type
    )
    return ToolCalibrationReminderListResponse(
        items=[ToolCalibrationReminderResponse.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )
