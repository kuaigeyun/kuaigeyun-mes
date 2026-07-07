"""
付款单管理 API 路由
"""

import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from datetime import date, datetime
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    PaymentVoucherCreate, PaymentVoucherUpdate,
    PaymentVoucherResponse, PaymentVoucherListResponse,
)
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.services.payment_pull_service import PaymentPullService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import BusinessLogicError

router = APIRouter(prefix="/payments", tags=["App · Kuaicaiwu · Finance"])
payment_pull_service = PaymentPullService()


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
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建付款单"""
    try:
        pull_preview: Optional[Dict[str, Any]] = None
        if data.source_type and data.source_id:
            pull_preview = await payment_pull_service.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                total_amount=Decimal(data.total_amount),
            )

        today = datetime.now().strftime("%Y%m%d")
        count = await Payment.filter(tenant_id=tenant_id).count()
        code = f"PK{today}{count + 1:04d}"
        supplier_id = data.supplier_id
        supplier_name = data.supplier_name
        if pull_preview:
            supplier_id = int(pull_preview.get("supplier_id") or supplier_id)
            supplier_name = str(pull_preview.get("supplier_name") or supplier_name or "")

        payment = await Payment.create(
            tenant_id=tenant_id,
            payment_code=code,
            supplier_id=supplier_id,
            supplier_name=supplier_name,
            total_amount=data.total_amount,
            settled_amount=0,
            unsettled_amount=data.total_amount,
            payment_date=data.payment_date,
            payment_method=data.payment_method,
            bank_account=data.bank_account,
            bank_account_id=data.bank_account_id,
            settlement_type=data.settlement_type or "normal",
            status="Draft",
            notes=data.notes,
            attachments=data.attachments,
            created_by=current_user.id,
        )
        if pull_preview and data.source_type and data.source_id:
            await payment_pull_service.create_pull_relation(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                source_code=str(pull_preview.get("source_code") or ""),
                payment_id=int(payment.id),
                payment_code=str(payment.payment_code),
                created_by=current_user.id,
            )
        return _serialize(payment)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/payments", tenant_id) from e


@router.get("", response_model=PaymentVoucherListResponse)
async def list_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    unsettled_only: bool = Query(False, description="仅返回有余额的付款单（unsettled_amount > 0）"),
    settlement_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取付款单列表"""
    query = Payment.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if status:
        query = query.filter(status=status)
    if unsettled_only:
        query = query.filter(unsettled_amount__gt=0).exclude(status="Cancelled")
    if supplier_id:
        query = query.filter(supplier_id=supplier_id)
    if settlement_type:
        query = query.filter(settlement_type=settlement_type)
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


@router.get(
    "/pull-candidates/payables",
    summary="List payable pull candidates for payment",
)
async def list_payment_payable_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await payment_pull_service.list_payable_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-payable/{payable_id}/pull-preview",
    summary="Preview pull payment from payable",
)
async def preview_pull_payment_from_payable(
    payable_id: int = Path(..., description="应付单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await payment_pull_service.preview_pull_from_payable(
        tenant_id=tenant_id,
        payable_id=payable_id,
    )


@router.get("/{id}", response_model=PaymentVoucherResponse)
async def get_payment(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取付款单详情"""
    payment = await _get_or_404(tenant_id, id)
    return _serialize(payment)


@router.put("/{id}", response_model=PaymentVoucherResponse)
async def update_payment(
    id: int,
    data: PaymentVoucherUpdate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:update")),
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
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """确认付款单"""
    payment = await _get_or_404(tenant_id, id)
    if payment.status != "Draft":
        raise _http_exception_with_trace(400, "只有草稿状态的付款单可以确认", "/payments/{id}/confirm", tenant_id)
    from apps.kuaicaiwu.services.bank_account_service import BankAccountService
    from infra.exceptions.exceptions import ValidationError

    if payment.bank_account_id:
        try:
            await BankAccountService().sync_from_confirmed_voucher(
                tenant_id, voucher_type="payment", voucher_id=id
            )
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail={"message": str(exc)})
    await Payment.filter(id=id).update(status="Confirmed")
    return _serialize(await _get_or_404(tenant_id, id))


@router.post("/{id}/cancel", response_model=PaymentVoucherResponse)
async def cancel_payment(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
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
    _auth: object = Depends(require_permission_codes("kuaicaiwu:payment:delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """删除付款单"""
    payment = await _get_or_404(tenant_id, id)
    if payment.status == "Confirmed":
        raise _http_exception_with_trace(400, "已确认的付款单不能删除", "/payments/{id}", tenant_id)
    await Payment.filter(id=id).delete()
