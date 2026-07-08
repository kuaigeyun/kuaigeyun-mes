"""
模具运营单据 API：试模、领用、归还、保养、维修。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.mold_ops import (
    MoldTrialCreate,
    MoldTrialUpdate,
    MoldTrialResponse,
    MoldTrialListResponse,
    MoldBorrowCreate,
    MoldBorrowUpdate,
    MoldBorrowResponse,
    MoldBorrowListResponse,
    MoldReturnCreate,
    MoldReturnUpdate,
    MoldReturnResponse,
    MoldReturnListResponse,
    MoldMaintenanceCreate,
    MoldMaintenanceUpdate,
    MoldMaintenanceResponse,
    MoldMaintenanceListResponse,
    MoldMaintenanceLineResponse,
    MoldMaintenancePreviewResponse,
    MoldMaintenanceReject,
    MoldRepairCreate,
    MoldRepairUpdate,
    MoldRepairResponse,
    MoldRepairListResponse,
    MoldRepairLineResponse,
    MoldRepairPreviewResponse,
    MoldRepairReject,
    MoldScrapApplicationCreate,
    MoldScrapApplicationUpdate,
    MoldScrapApplicationResponse,
    MoldScrapApplicationListResponse,
    MoldScrapApplicationReject,
)
from apps.kuaizhizao.services.mold_ops_service import MoldOpsService

router = APIRouter()
svc = MoldOpsService()


def _http_from_exc(e: Exception) -> HTTPException:
    if isinstance(e, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _maintenance_response(header, lines=None) -> MoldMaintenanceResponse:
    resp = MoldMaintenanceResponse.model_validate(header)
    if lines is not None:
        resp.lines = [MoldMaintenanceLineResponse.model_validate(l) for l in lines]
    return resp


def _repair_response(header, lines=None) -> MoldRepairResponse:
    resp = MoldRepairResponse.model_validate(header)
    if lines is not None:
        resp.lines = [MoldRepairLineResponse.model_validate(l) for l in lines]
    return resp


# ---------- 试模 ----------

@router.post(
    "/mold-trials",
    response_model=MoldTrialResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-trial:create"))],
)
async def create_mold_trial(
    data: MoldTrialCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.trial_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
        )
        return MoldTrialResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/mold-trials",
    response_model=MoldTrialListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-trial:read"))],
)
async def list_mold_trials(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),
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
    rows, total = await svc.trial_service.list(tenant_id, skip, limit, mold_id, status_filter,
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
    return MoldTrialListResponse(
        items=[MoldTrialResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-trials/{row_id}",
    response_model=MoldTrialResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-trial:read"))],
)
async def get_mold_trial(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.trial_service.get(tenant_id, row_id)
        return MoldTrialResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/mold-trials/{row_id}",
    response_model=MoldTrialResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-trial:update"))],
)
async def update_mold_trial(
    row_id: int,
    data: MoldTrialUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.trial_service.update(tenant_id, row_id, data)
        return MoldTrialResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/mold-trials/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-trial:delete"))],
)
async def delete_mold_trial(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.trial_service.delete(tenant_id, row_id)
    except NotFoundError as e:
        raise _http_from_exc(e)


# ---------- 领用 ----------

@router.post(
    "/mold-borrows",
    response_model=MoldBorrowResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-borrow:create"))],
)
async def create_mold_borrow(
    data: MoldBorrowCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.borrow_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
        )
        return MoldBorrowResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/mold-borrows/outstanding",
    response_model=MoldBorrowListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-borrow:read"))],
)
async def list_outstanding_mold_borrows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),

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
    rows, total = await svc.borrow_service.list_outstanding(tenant_id, skip, limit, mold_id)
    return MoldBorrowListResponse(
        items=[MoldBorrowResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-borrows",
    response_model=MoldBorrowListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-borrow:read"))],
)
async def list_mold_borrows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),
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
    rows, total = await svc.borrow_service.list(tenant_id, skip, limit, mold_id, status_filter,
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
    return MoldBorrowListResponse(
        items=[MoldBorrowResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-borrows/{row_id}",
    response_model=MoldBorrowResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-borrow:read"))],
)
async def get_mold_borrow(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.borrow_service.get(tenant_id, row_id)
        return MoldBorrowResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/mold-borrows/{row_id}",
    response_model=MoldBorrowResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-borrow:update"))],
)
async def update_mold_borrow(
    row_id: int,
    data: MoldBorrowUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.borrow_service.update(tenant_id, row_id, data)
        return MoldBorrowResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/mold-borrows/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-borrow:delete"))],
)
async def delete_mold_borrow(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.borrow_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


# ---------- 归还 ----------

@router.post(
    "/mold-returns",
    response_model=MoldReturnResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-return:create"))],
)
async def create_mold_return(
    data: MoldReturnCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.return_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
        )
        return MoldReturnResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/mold-returns",
    response_model=MoldReturnListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-return:read"))],
)
async def list_mold_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),

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
    rows, total = await svc.return_service.list(tenant_id, skip, limit, mold_id,
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
    return MoldReturnListResponse(
        items=[MoldReturnResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-returns/{row_id}",
    response_model=MoldReturnResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-return:read"))],
)
async def get_mold_return(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.return_service.get(tenant_id, row_id)
        return MoldReturnResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/mold-returns/{row_id}",
    response_model=MoldReturnResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-return:update"))],
)
async def update_mold_return(
    row_id: int,
    data: MoldReturnUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.return_service.update(tenant_id, row_id, data)
        return MoldReturnResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/mold-returns/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-return:delete"))],
)
async def delete_mold_return(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.return_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


# ---------- 保养 ----------

@router.get(
    "/mold-maintenances/preview-lines",
    response_model=MoldMaintenancePreviewResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:read"))],
)
async def preview_mold_maintenance_lines(
    mold_id: int = Query(..., ge=1),
    scheme_id: Optional[int] = Query(None, ge=1),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await svc.maintenance_service.preview_lines(tenant_id, mold_id, scheme_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-maintenances",
    response_model=MoldMaintenanceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:create"))],
)
async def create_mold_maintenance(
    data: MoldMaintenanceCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.maintenance_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
        )
        lines = await svc.maintenance_service._load_lines(tenant_id, header.id)
        return _maintenance_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/mold-maintenances",
    response_model=MoldMaintenanceListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:read"))],
)
async def list_mold_maintenances(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),
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
    rows, total = await svc.maintenance_service.list(tenant_id, skip, limit, mold_id, status_filter,
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
    return MoldMaintenanceListResponse(
        items=[MoldMaintenanceResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-maintenances/{row_id}",
    response_model=MoldMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:read"))],
)
async def get_mold_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        header = await svc.maintenance_service.get(tenant_id, row_id)
        lines = await svc.maintenance_service._load_lines(tenant_id, header.id)
        return _maintenance_response(header, lines)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/mold-maintenances/{row_id}",
    response_model=MoldMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:update"))],
)
async def update_mold_maintenance(
    row_id: int,
    data: MoldMaintenanceUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.maintenance_service.update(tenant_id, row_id, data)
        lines = await svc.maintenance_service._load_lines(tenant_id, header.id)
        return _maintenance_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-maintenances/{row_id}/submit",
    response_model=MoldMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:submit"))],
)
async def submit_mold_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.maintenance_service.submit(tenant_id, row_id)
        return MoldMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-maintenances/{row_id}/approve",
    response_model=MoldMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:approve"))],
)
async def approve_mold_maintenance(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        return MoldMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-maintenances/{row_id}/reject",
    response_model=MoldMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:reject"))],
)
async def reject_mold_maintenance(
    row_id: int,
    body: MoldMaintenanceReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.maintenance_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        return MoldMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-maintenances/{row_id}/complete",
    response_model=MoldMaintenanceResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:update"))],
)
async def complete_mold_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.maintenance_service.complete(tenant_id, row_id)
        return MoldMaintenanceResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/mold-maintenances/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance:delete"))],
)
async def delete_mold_maintenance(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.maintenance_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


# ---------- 维修 ----------

@router.get(
    "/mold-repairs/preview-lines",
    response_model=MoldRepairPreviewResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:read"))],
)
async def preview_mold_repair_lines(
    mold_id: int = Query(..., ge=1),
    scheme_id: Optional[int] = Query(None, ge=1),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await svc.repair_service.preview_lines(tenant_id, mold_id, scheme_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-repairs",
    response_model=MoldRepairResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:create"))],
)
async def create_mold_repair(
    data: MoldRepairCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.repair_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
        )
        lines = await svc.repair_service._load_lines(tenant_id, header.id)
        return _repair_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/mold-repairs",
    response_model=MoldRepairListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:read"))],
)
async def list_mold_repairs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),
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
    rows, total = await svc.repair_service.list(tenant_id, skip, limit, mold_id, status_filter,
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
    return MoldRepairListResponse(
        items=[MoldRepairResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-repairs/{row_id}",
    response_model=MoldRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:read"))],
)
async def get_mold_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        header = await svc.repair_service.get(tenant_id, row_id)
        lines = await svc.repair_service._load_lines(tenant_id, header.id)
        return _repair_response(header, lines)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/mold-repairs/{row_id}",
    response_model=MoldRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:update"))],
)
async def update_mold_repair(
    row_id: int,
    data: MoldRepairUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.repair_service.update(tenant_id, row_id, data)
        lines = await svc.repair_service._load_lines(tenant_id, header.id)
        return _repair_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-repairs/{row_id}/submit",
    response_model=MoldRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:submit"))],
)
async def submit_mold_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.repair_service.submit(tenant_id, row_id)
        return MoldRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-repairs/{row_id}/approve",
    response_model=MoldRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:approve"))],
)
async def approve_mold_repair(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        return MoldRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-repairs/{row_id}/reject",
    response_model=MoldRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:reject"))],
)
async def reject_mold_repair(
    row_id: int,
    body: MoldRepairReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.repair_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        return MoldRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-repairs/{row_id}/complete",
    response_model=MoldRepairResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:update"))],
)
async def complete_mold_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.repair_service.complete(tenant_id, row_id)
        return MoldRepairResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/mold-repairs/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-repair:delete"))],
)
async def delete_mold_repair(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.repair_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


# ---------- 报废申请 ----------

@router.post(
    "/mold-scrap-applications",
    response_model=MoldScrapApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:create"))],
)
async def create_mold_scrap_application(
    data: MoldScrapApplicationCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
        )
        return MoldScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.get(
    "/mold-scrap-applications",
    response_model=MoldScrapApplicationListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:read"))],
)
async def list_mold_scrap_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),
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
        tenant_id, skip, limit, mold_id, status_filter
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
    return MoldScrapApplicationListResponse(
        items=[MoldScrapApplicationResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/mold-scrap-applications/{row_id}",
    response_model=MoldScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:read"))],
)
async def get_mold_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.scrap_application_service.get(tenant_id, row_id)
        return MoldScrapApplicationResponse.model_validate(row)
    except NotFoundError as e:
        raise _http_from_exc(e)


@router.put(
    "/mold-scrap-applications/{row_id}",
    response_model=MoldScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:update"))],
)
async def update_mold_scrap_application(
    row_id: int,
    data: MoldScrapApplicationUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.update(tenant_id, row_id, data)
        return MoldScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-scrap-applications/{row_id}/submit",
    response_model=MoldScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:submit"))],
)
async def submit_mold_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.scrap_application_service.submit(tenant_id, row_id)
        return MoldScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-scrap-applications/{row_id}/approve",
    response_model=MoldScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:approve"))],
)
async def approve_mold_scrap_application(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        return MoldScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.post(
    "/mold-scrap-applications/{row_id}/reject",
    response_model=MoldScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:reject"))],
)
async def reject_mold_scrap_application(
    row_id: int,
    body: MoldScrapApplicationReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        return MoldScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)


@router.delete(
    "/mold-scrap-applications/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-scrap:delete"))],
)
async def delete_mold_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.scrap_application_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        raise _http_from_exc(e)
