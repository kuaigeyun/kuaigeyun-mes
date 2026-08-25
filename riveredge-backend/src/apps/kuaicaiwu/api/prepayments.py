"""
预收/预付 API
"""

from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from apps.kuaicaiwu.services.prepayment_service import PrepaymentService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_user
from core.schemas.base import BaseSchema
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/prepayments",
    tags=["App - Kuaicaiwu - Prepayments"],
    dependencies=[Depends(require_kuaicaiwu_module_access("prepayment"))],
)
service = PrepaymentService()


class PrepaymentApplyRequest(BaseSchema):
    amount: Decimal = Field(..., gt=0, description="核销金额")


class PrepaymentApplyReceivableRequest(PrepaymentApplyRequest):
    receipt_id: int
    receivable_id: int


class PrepaymentApplyPayableRequest(PrepaymentApplyRequest):
    payment_id: int
    payable_id: int


@router.get("/balances", summary="预收/预付余额汇总")
async def get_prepayment_balances(
    partner_type: Optional[str] = Query(None, description="customer 或 supplier；传入时分页返回 items"),
    keyword: Optional[str] = Query(None),
    partner_name: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:prepayment:read")),
    current_user: Any = Depends(get_current_user),
):
    from apps.kuaicaiwu.services.document_reconciliation_service import DocumentReconciliationService

    return await DocumentReconciliationService().get_prepayment_balances(
        current_user.tenant_id,
        partner_type=partner_type,
        keyword=keyword,
        partner_name=partner_name,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        operator_id=getattr(current_user, "id", None),
    )


@router.post("/apply-receivable", summary="预收转核销应收")
async def apply_receipt_to_receivable(
    data: PrepaymentApplyReceivableRequest,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:prepayment:update")),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await service.apply_receipt_to_receivable(
            current_user.tenant_id,
            receipt_id=data.receipt_id,
            receivable_id=data.receivable_id,
            amount=data.amount,
            operator_id=current_user.id,
        )
    except (NotFoundError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/apply-payable", summary="预付转核销应付")
async def apply_payment_to_payable(
    data: PrepaymentApplyPayableRequest,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:prepayment:update")),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await service.apply_payment_to_payable(
            current_user.tenant_id,
            payment_id=data.payment_id,
            payable_id=data.payable_id,
            amount=data.amount,
            operator_id=current_user.id,
        )
    except (NotFoundError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
