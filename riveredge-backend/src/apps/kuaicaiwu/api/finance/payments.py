"""
付款单管理 API 路由
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import date
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    PaymentVoucherCreate, PaymentVoucherUpdate,
    PaymentVoucherResponse, PaymentVoucherListResponse,
)
from apps.kuaicaiwu.models.payment import Payment
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError
from apps.base_service import AppBaseService
from datetime import datetime

router = APIRouter(prefix="/payments", tags=["Kuaicaiwu Finance"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_payments_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


async def _get_or_404(tenant_id: int, payment_id: int, route: str = "/payments/{id}") -> Payment:
    obj = await Payment.get_or_none(tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True)
    if not obj:
        raise _http_exception_with_trace(404, f"付款单不存在: {payment_id}", route, tenant_id)
    return obj


def _serialize(obj: Payment) -> PaymentVoucherResponse:
    return PaymentVoucherResponse.model_validate(obj)


@router.post("", response_model=PaymentVoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    data: PaymentVoucherCreate,
    _auth: object = Depends(
        require_access(
            "finance.payment",
            "create",
            required_permissions=["kuaicaiwu:payable:create"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建付款单"""
    today = datetime.now().strftime("%Y%m%d")
    # 生成编号
    count = await Payment.filter(tenant_id=tenant_id).count()
    code = f"PK{today}{count + 1:04d}"
    payment = await Payment.create(
        tenant_id=tenant_id,
        payment_code=code,
        supplier_id=data.supplier_id,
        supplier_name=data.supplier_name,
        total_amount=data.total_amount,
        settled_amount=0,
        unsettled_amount=data.total_amount,
        payment_date=data.payment_date,
        payment_method=data.payment_method,
        bank_account=data.bank_account,
        status="Draft",
        notes=data.notes,
        created_by=current_user.id,
    )
    return _serialize(payment)


@router.get("", response_model=PaymentVoucherListResponse)
async def list_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _auth: object = Depends(
        require_access(
            "finance.payment",
            "read",
            required_permissions=["kuaicaiwu:payable:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取付款单列表"""
    query = Payment.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if status:
        query = query.filter(status=status)
    if supplier_id:
        query = query.filter(supplier_id=supplier_id)
    if start_date:
        query = query.filter(payment_date__gte=start_date)
    if end_date:
        query = query.filter(payment_date__lte=end_date)

    total = await query.count()
    items = await query.offset(skip).limit(limit).order_by("-payment_date", "-id")
    return PaymentVoucherListResponse(
        items=[_serialize(p) for p in items],
        total=total, skip=skip, limit=limit
    )


@router.get("/{id}", response_model=PaymentVoucherResponse)
async def get_payment(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.payment",
            "read",
            required_permissions=["kuaicaiwu:payable:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取付款单详情"""
    payment = await _get_or_404(tenant_id, id)
    return _serialize(payment)


@router.put("/{id}", response_model=PaymentVoucherResponse)
async def update_payment(
    id: int,
    data: PaymentVoucherUpdate,
    _auth: object = Depends(
        require_access(
            "finance.payment",
            "update",
            required_permissions=["kuaicaiwu:payable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """更新付款单"""
    payment = await _get_or_404(tenant_id, id)
    if payment.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的付款单不能修改", "/payments/{id}", tenant_id)
    update_data = data.model_dump(exclude_unset=True)
    await Payment.filter(id=id).update(**update_data)
    return _serialize(await _get_or_404(tenant_id, id))


@router.post("/{id}/confirm", response_model=PaymentVoucherResponse)
async def confirm_payment(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.payment",
            "update",
            required_permissions=["kuaicaiwu:payable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """确认付款单"""
    payment = await _get_or_404(tenant_id, id)
    if payment.status != "Draft":
        raise _http_exception_with_trace(400, "只有草稿状态的付款单可以确认", "/payments/{id}/confirm", tenant_id)
    await Payment.filter(id=id).update(status="Confirmed")
    return _serialize(await _get_or_404(tenant_id, id))


@router.post("/{id}/cancel", response_model=PaymentVoucherResponse)
async def cancel_payment(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.payment",
            "update",
            required_permissions=["kuaicaiwu:payable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """作废付款单"""
    payment = await _get_or_404(tenant_id, id)
    if payment.settled_amount > 0:
        raise _http_exception_with_trace(400, "已有核销记录的付款单不能作废", "/payments/{id}/cancel", tenant_id)
    await Payment.filter(id=id).update(status="Cancelled")
    return _serialize(await _get_or_404(tenant_id, id))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.payment",
            "delete",
            required_permissions=["kuaicaiwu:payable:delete"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """删除付款单"""
    payment = await _get_or_404(tenant_id, id)
    if payment.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的付款单不能删除", "/payments/{id}", tenant_id)
    await Payment.filter(id=id).delete()
