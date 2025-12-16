"""
付款 API 模块

提供付款的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from datetime import datetime

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.payment_service import PaymentService
from apps.kuaiacc.schemas.payment_schemas import (
    PaymentCreate, PaymentUpdate, PaymentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("", response_model=PaymentResponse, summary="创建付款")
async def create_payment(
    data: PaymentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建付款"""
    try:
        return await PaymentService.create_payment(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[PaymentResponse], summary="获取付款列表")
async def list_payments(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """获取付款列表"""
    return await PaymentService.list_payments(
        tenant_id, skip, limit, supplier_id, status, start_date, end_date
    )


@router.get("/{uuid}", response_model=PaymentResponse, summary="获取付款详情")
async def get_payment(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取付款详情"""
    try:
        return await PaymentService.get_payment_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=PaymentResponse, summary="更新付款")
async def update_payment(
    uuid: str,
    data: PaymentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新付款"""
    try:
        return await PaymentService.update_payment(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除付款")
async def delete_payment(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除付款（软删除）"""
    try:
        await PaymentService.delete_payment(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

