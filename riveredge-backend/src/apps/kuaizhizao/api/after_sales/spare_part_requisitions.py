"""售后备件申领 API"""

from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_service import (
    AfterSalesSparePartRequisitionAudit,
    AfterSalesSparePartRequisitionCreate,
    AfterSalesSparePartRequisitionListEnvelope,
    AfterSalesSparePartRequisitionReject,
    AfterSalesSparePartRequisitionResponse,
    AfterSalesSparePartRequisitionUpdate,
)
from apps.kuaizhizao.services.after_sales_spare_part_requisition_service import (
    AfterSalesSparePartRequisitionService,
)
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/after-sales/spare-part-requisitions",
    tags=["App - Kuaige Zhizao - After-sales Spare Part Requisition"],
    dependencies=[Depends(require_kuaizhizao_module_access("after-sales-spare-part-requisition"))],
)
_service = AfterSalesSparePartRequisitionService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaizhizao_spare_part_requisitions_api_error trace_id={} message={}", trace_id, message)
    return FastAPIHTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception(status_code, message)


@router.post("", response_model=AfterSalesSparePartRequisitionResponse, summary="Create requisition")
async def create_requisition(
    body: AfterSalesSparePartRequisitionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=AfterSalesSparePartRequisitionListEnvelope, summary="List requisitions")
async def list_requisitions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_requisitions(
        tenant_id,
        skip=skip,
        limit=limit,
        status=status_filter,
        keyword=keyword,
    )


@router.get("/{requisition_id}", response_model=AfterSalesSparePartRequisitionResponse, summary="Get requisition")
async def get_requisition(
    requisition_id: int = Path(..., description="申领单ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, requisition_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{requisition_id}", response_model=AfterSalesSparePartRequisitionResponse, summary="Update requisition")
async def update_requisition(
    body: AfterSalesSparePartRequisitionUpdate,
    requisition_id: int = Path(..., description="申领单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, requisition_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{requisition_id}/submit", response_model=AfterSalesSparePartRequisitionResponse, summary="Submit requisition")
async def submit_requisition(
    requisition_id: int = Path(..., description="申领单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.submit(tenant_id, requisition_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{requisition_id}/audit", response_model=AfterSalesSparePartRequisitionResponse, summary="Audit requisition")
async def audit_requisition(
    body: AfterSalesSparePartRequisitionAudit,
    requisition_id: int = Path(..., description="申领单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.audit(tenant_id, requisition_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{requisition_id}/reject", response_model=AfterSalesSparePartRequisitionResponse, summary="Reject requisition")
async def reject_requisition(
    body: AfterSalesSparePartRequisitionReject,
    requisition_id: int = Path(..., description="申领单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.reject(tenant_id, requisition_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{requisition_id}", summary="Delete requisition")
async def delete_requisition(
    requisition_id: int = Path(..., description="申领单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, requisition_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
