"""
收款 API 模块

提供收款的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from datetime import datetime

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.receipt_service import ReceiptService
from apps.kuaiacc.schemas.receipt_schemas import (
    ReceiptCreate, ReceiptUpdate, ReceiptResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.post("", response_model=ReceiptResponse, summary="创建收款")
async def create_receipt(
    data: ReceiptCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建收款"""
    try:
        return await ReceiptService.create_receipt(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ReceiptResponse], summary="获取收款列表")
async def list_receipts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    customer_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """获取收款列表"""
    return await ReceiptService.list_receipts(
        tenant_id, skip, limit, customer_id, status, start_date, end_date
    )


@router.get("/{uuid}", response_model=ReceiptResponse, summary="获取收款详情")
async def get_receipt(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取收款详情"""
    try:
        return await ReceiptService.get_receipt_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=ReceiptResponse, summary="更新收款")
async def update_receipt(
    uuid: str,
    data: ReceiptUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新收款"""
    try:
        return await ReceiptService.update_receipt(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除收款")
async def delete_receipt(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除收款（软删除）"""
    try:
        await ReceiptService.delete_receipt(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

