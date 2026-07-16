"""备件领用单 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.spare_part_requisition import (
    SparePartRequisitionCreate,
    SparePartRequisitionUpdate,
    SparePartRequisitionResponse,
    SparePartRequisitionListResponse,
    SparePartRequisitionReject,
    SparePartRequisitionLineResponse,
)
from apps.kuaizhizao.services.spare_part_requisition_service import SparePartRequisitionService

router = APIRouter(prefix="/spare-part-requisitions", tags=["App - Kuaige Zhizao - Spare Part Requisitions"])
service = SparePartRequisitionService()


def _response(header, lines=None) -> SparePartRequisitionResponse:
    resp = SparePartRequisitionResponse.model_validate(header)
    if lines is not None:
        resp.lines = [SparePartRequisitionLineResponse.model_validate(l) for l in lines]
    return resp


@router.post(
    "",
    response_model=SparePartRequisitionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part-requisition:create"))],
)
async def create_spare_part_requisition(
    data: SparePartRequisitionCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.full_name or current_user.username,
            current_user=current_user,
        )
        lines = await service._load_lines(tenant_id, header.id)
        return _response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.get("", response_model=SparePartRequisitionListResponse)
async def list_spare_part_requisitions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词（与 keyword 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await service.list(
        tenant_id,
        skip,
        limit,
        status_filter,
        keyword=keyword,
        search=search,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    items = []
    for row in rows:
        lines = await service._load_lines(tenant_id, row.id)
        items.append(_response(row, lines))
    return SparePartRequisitionListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{row_id}", response_model=SparePartRequisitionResponse)
async def get_spare_part_requisition(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        header = await service.get(tenant_id, row_id)
        lines = await service._load_lines(tenant_id, header.id)
        return _response(header, lines)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/{row_id}",
    response_model=SparePartRequisitionResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part-requisition:update"))],
)
async def update_spare_part_requisition(
    row_id: int,
    data: SparePartRequisitionUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await service.update(tenant_id, row_id, data, current_user=current_user)
        lines = await service._load_lines(tenant_id, header.id)
        return _response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/{row_id}/submit",
    response_model=SparePartRequisitionResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part-requisition:submit"))],
)
async def submit_spare_part_requisition(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await service.submit(tenant_id, row_id, current_user=current_user)
        lines = await service._load_lines(tenant_id, header.id)
        return _response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/{row_id}/approve",
    response_model=SparePartRequisitionResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part-requisition:approve"))],
)
async def approve_spare_part_requisition(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        lines = await service._load_lines(tenant_id, header.id)
        return _response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/{row_id}/reject",
    response_model=SparePartRequisitionResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part-requisition:reject"))],
)
async def reject_spare_part_requisition(
    row_id: int,
    body: SparePartRequisitionReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.full_name or current_user.username,
        )
        lines = await service._load_lines(tenant_id, header.id)
        return _response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:spare-part-requisition:delete"))],
)
async def delete_spare_part_requisition(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))
