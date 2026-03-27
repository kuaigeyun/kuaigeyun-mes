"""
收款单管理 API 路由
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import date, datetime

from apps.kuaicaiwu.schemas.finance import (
    ReceiptVoucherCreate, ReceiptVoucherUpdate,
    ReceiptVoucherResponse, ReceiptVoucherListResponse,
)
from apps.kuaicaiwu.models.receipt import Receipt
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/receipts", tags=["Kuaicaiwu Finance"])


async def _get_or_404(tenant_id: int, receipt_id: int) -> Receipt:
    obj = await Receipt.get_or_none(tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True)
    if not obj:
        raise HTTPException(status_code=404, detail=f"收款单不存在: {receipt_id}")
    return obj


def _serialize(obj: Receipt) -> ReceiptVoucherResponse:
    return ReceiptVoucherResponse.model_validate(obj)


@router.post("", response_model=ReceiptVoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    data: ReceiptVoucherCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建收款单"""
    today = datetime.now().strftime("%Y%m%d")
    count = await Receipt.filter(tenant_id=tenant_id).count()
    code = f"SK{today}{count + 1:04d}"
    receipt = await Receipt.create(
        tenant_id=tenant_id,
        receipt_code=code,
        customer_id=data.customer_id,
        customer_name=data.customer_name,
        total_amount=data.total_amount,
        settled_amount=0,
        unsettled_amount=data.total_amount,
        receipt_date=data.receipt_date,
        payment_method=data.payment_method,
        bank_account=data.bank_account,
        status="Draft",
        notes=data.notes,
        created_by=current_user.id,
    )
    return _serialize(receipt)


@router.get("", response_model=ReceiptVoucherListResponse)
async def list_receipts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    tenant_id: int = Depends(get_current_tenant)
):
    """获取收款单列表"""
    query = Receipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if status:
        query = query.filter(status=status)
    if customer_id:
        query = query.filter(customer_id=customer_id)
    if start_date:
        query = query.filter(receipt_date__gte=start_date)
    if end_date:
        query = query.filter(receipt_date__lte=end_date)

    total = await query.count()
    items = await query.offset(skip).limit(limit).order_by("-receipt_date", "-id")
    return ReceiptVoucherListResponse(
        items=[_serialize(r) for r in items],
        total=total, skip=skip, limit=limit
    )


@router.get("/{id}", response_model=ReceiptVoucherResponse)
async def get_receipt(
    id: int,
    tenant_id: int = Depends(get_current_tenant)
):
    """获取收款单详情"""
    receipt = await _get_or_404(tenant_id, id)
    return _serialize(receipt)


@router.put("/{id}", response_model=ReceiptVoucherResponse)
async def update_receipt(
    id: int,
    data: ReceiptVoucherUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """更新收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise HTTPException(status_code=400, detail="已确认的收款单不能修改")
    update_data = data.model_dump(exclude_unset=True)
    await Receipt.filter(id=id).update(**update_data)
    return _serialize(await _get_or_404(tenant_id, id))


@router.post("/{id}/confirm", response_model=ReceiptVoucherResponse)
async def confirm_receipt(
    id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """确认收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status != "Draft":
        raise HTTPException(status_code=400, detail="只有草稿状态的收款单可以确认")
    await Receipt.filter(id=id).update(status="Confirmed")
    return _serialize(await _get_or_404(tenant_id, id))


@router.post("/{id}/cancel", response_model=ReceiptVoucherResponse)
async def cancel_receipt(
    id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """作废收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.settled_amount > 0:
        raise HTTPException(status_code=400, detail="已有核销记录的收款单不能作废")
    await Receipt.filter(id=id).update(status="Cancelled")
    return _serialize(await _get_or_404(tenant_id, id))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """删除收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise HTTPException(status_code=400, detail="已确认的收款单不能删除")
    await Receipt.filter(id=id).delete()
