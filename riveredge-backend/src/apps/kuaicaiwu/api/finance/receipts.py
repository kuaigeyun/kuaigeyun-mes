"""
收款单管理 API 路由
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import date, datetime
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    ReceiptVoucherCreate, ReceiptVoucherUpdate,
    ReceiptVoucherResponse, ReceiptVoucherListResponse,
)
from apps.kuaicaiwu.models.receipt import Receipt
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/receipts", tags=["App · Kuaicaiwu · Finance"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_receipts_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


async def _get_or_404(tenant_id: int, receipt_id: int, route: str = "/receipts/{id}") -> Receipt:
    obj = await Receipt.get_or_none(tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True)
    if not obj:
        raise _http_exception_with_trace(404, f"收款单不存在: {receipt_id}", route, tenant_id)
    return obj


async def _serialize(tenant_id: int, user_id: int, obj: Receipt) -> ReceiptVoucherResponse:
    payload = ReceiptVoucherResponse.model_validate(obj).model_dump()
    masked = await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaicaiwu:receipt",
        payload=payload,
    )
    return ReceiptVoucherResponse.model_validate(masked)


@router.post("", response_model=ReceiptVoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    data: ReceiptVoucherCreate,
    _auth: object = Depends(
        require_access(
            "finance.receipt",
            "create",
            required_permissions=["kuaicaiwu:receivable:create"],
        )
    ),
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
    return await _serialize(tenant_id, current_user.id, receipt)


@router.get("", response_model=ReceiptVoucherListResponse)
async def list_receipts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _auth: object = Depends(
        require_access(
            "finance.receipt",
            "read",
            required_permissions=["kuaicaiwu:receivable:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
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
    serialized = [await _serialize(tenant_id, current_user.id, r) for r in items]
    return ReceiptVoucherListResponse(
        items=serialized,
        total=total, skip=skip, limit=limit
    )


@router.get("/{id}", response_model=ReceiptVoucherResponse)
async def get_receipt(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.receipt",
            "read",
            required_permissions=["kuaicaiwu:receivable:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """获取收款单详情"""
    receipt = await _get_or_404(tenant_id, id)
    return await _serialize(tenant_id, current_user.id, receipt)


@router.put("/{id}", response_model=ReceiptVoucherResponse)
async def update_receipt(
    id: int,
    data: ReceiptVoucherUpdate,
    _auth: object = Depends(
        require_access(
            "finance.receipt",
            "update",
            required_permissions=["kuaicaiwu:receivable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的收款单不能修改", "/receipts/{id}", tenant_id)
    update_data = data.model_dump(exclude_unset=True)
    await Receipt.filter(id=id).update(**update_data)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/confirm", response_model=ReceiptVoucherResponse)
async def confirm_receipt(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.receipt",
            "update",
            required_permissions=["kuaicaiwu:receivable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """确认收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status != "Draft":
        raise _http_exception_with_trace(400, "只有草稿状态的收款单可以确认", "/receipts/{id}/confirm", tenant_id)
    await Receipt.filter(id=id).update(status="Confirmed")
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/cancel", response_model=ReceiptVoucherResponse)
async def cancel_receipt(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.receipt",
            "update",
            required_permissions=["kuaicaiwu:receivable:update"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """作废收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.settled_amount > 0:
        raise _http_exception_with_trace(400, "已有核销记录的收款单不能作废", "/receipts/{id}/cancel", tenant_id)
    await Receipt.filter(id=id).update(status="Cancelled")
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.receipt",
            "delete",
            required_permissions=["kuaicaiwu:receivable:delete"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """删除收款单"""
    receipt = await _get_or_404(tenant_id, id)
    if receipt.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的收款单不能删除", "/receipts/{id}", tenant_id)
    await Receipt.filter(id=id).delete()
