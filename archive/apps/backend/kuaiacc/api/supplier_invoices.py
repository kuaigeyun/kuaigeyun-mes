"""
供应商发票 API 模块

提供供应商发票的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from datetime import datetime

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.supplier_invoice_service import SupplierInvoiceService
from apps.kuaiacc.schemas.supplier_invoice_schemas import (
    SupplierInvoiceCreate, SupplierInvoiceUpdate, SupplierInvoiceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/supplier-invoices", tags=["Supplier Invoices"])


@router.post("", response_model=SupplierInvoiceResponse, summary="创建供应商发票")
async def create_supplier_invoice(
    data: SupplierInvoiceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建供应商发票"""
    try:
        return await SupplierInvoiceService.create_supplier_invoice(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SupplierInvoiceResponse], summary="获取供应商发票列表")
async def list_supplier_invoices(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """获取供应商发票列表"""
    return await SupplierInvoiceService.list_supplier_invoices(
        tenant_id, skip, limit, supplier_id, status, start_date, end_date
    )


@router.get("/{uuid}", response_model=SupplierInvoiceResponse, summary="获取供应商发票详情")
async def get_supplier_invoice(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取供应商发票详情"""
    try:
        return await SupplierInvoiceService.get_supplier_invoice_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=SupplierInvoiceResponse, summary="更新供应商发票")
async def update_supplier_invoice(
    uuid: str,
    data: SupplierInvoiceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新供应商发票"""
    try:
        return await SupplierInvoiceService.update_supplier_invoice(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除供应商发票")
async def delete_supplier_invoice(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除供应商发票（软删除）"""
    try:
        await SupplierInvoiceService.delete_supplier_invoice(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

