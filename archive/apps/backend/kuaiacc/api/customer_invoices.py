"""
客户发票 API 模块

提供客户发票的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from datetime import datetime

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.customer_invoice_service import CustomerInvoiceService
from apps.kuaiacc.schemas.customer_invoice_schemas import (
    CustomerInvoiceCreate, CustomerInvoiceUpdate, CustomerInvoiceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/customer-invoices", tags=["Customer Invoices"])


@router.post("", response_model=CustomerInvoiceResponse, summary="创建客户发票")
async def create_customer_invoice(
    data: CustomerInvoiceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建客户发票"""
    try:
        return await CustomerInvoiceService.create_customer_invoice(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CustomerInvoiceResponse], summary="获取客户发票列表")
async def list_customer_invoices(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    customer_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """获取客户发票列表"""
    return await CustomerInvoiceService.list_customer_invoices(
        tenant_id, skip, limit, customer_id, status, start_date, end_date
    )


@router.get("/{uuid}", response_model=CustomerInvoiceResponse, summary="获取客户发票详情")
async def get_customer_invoice(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取客户发票详情"""
    try:
        return await CustomerInvoiceService.get_customer_invoice_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=CustomerInvoiceResponse, summary="更新客户发票")
async def update_customer_invoice(
    uuid: str,
    data: CustomerInvoiceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新客户发票"""
    try:
        return await CustomerInvoiceService.update_customer_invoice(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除客户发票")
async def delete_customer_invoice(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除客户发票（软删除）"""
    try:
        await CustomerInvoiceService.delete_customer_invoice(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

