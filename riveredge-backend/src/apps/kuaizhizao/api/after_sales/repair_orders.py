"""维修单 API"""

from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_service import (
    RepairOrderClose,
    RepairOrderCreate,
    RepairOrderListEnvelope,
    RepairOrderResponse,
    RepairOrderUpdate,
)
from apps.kuaizhizao.services.repair_order_service import RepairOrderService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/after-sales/repair-orders",
    tags=["App - Kuaige Zhizao - Repair Order"],
    dependencies=[Depends(require_kuaizhizao_module_access("repair-order"))],
)
_service = RepairOrderService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaizhizao_repair_orders_api_error trace_id={} message={}", trace_id, message)
    return FastAPIHTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception(status_code, message)


@router.post("", response_model=RepairOrderResponse, summary="Create repair order")
async def create_order(
    body: RepairOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=RepairOrderListEnvelope, summary="List repair orders")
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    warranty_status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_orders(
        tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        status=status_filter,
        warranty_status=warranty_status,
        keyword=keyword,
    )


@router.get("/{order_id}", response_model=RepairOrderResponse, summary="Get repair order")
async def get_order(
    order_id: int = Path(..., description="维修单ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, order_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{order_id}", response_model=RepairOrderResponse, summary="Update repair order")
async def update_order(
    body: RepairOrderUpdate,
    order_id: int = Path(..., description="维修单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, order_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{order_id}/close", response_model=RepairOrderResponse, summary="Close repair order")
async def close_order(
    body: RepairOrderClose,
    order_id: int = Path(..., description="维修单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.close(tenant_id, order_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{order_id}", summary="Delete repair order")
async def delete_order(
    order_id: int = Path(..., description="维修单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, order_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
