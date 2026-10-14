"""其他费用支出 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaizhizao.schemas.other_voucher import (
    OtherExpenseCreate,
    OtherExpenseResponse,
    OtherExpenseUpdate,
    ReviewActionBody,
)
from apps.kuaizhizao.services.misc_voucher_posting_service import MiscVoucherPostingService
from apps.kuaizhizao.services.other_expense_service import OtherExpenseService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/other-expenses", tags=["App - Kuaizhizao - Other Expense"])
service = OtherExpenseService()
posting = MiscVoucherPostingService()


def _http(status_code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)


@router.get("", response_model=dict)
async def list_other_expenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_expenses(
        tenant_id, skip=skip, limit=limit, status=status, keyword=keyword
    )


@router.post("", response_model=OtherExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_other_expense(
    body: OtherExpenseCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_expense(tenant_id, body, current_user.id)
    except (ValidationError, BusinessLogicError) as exc:
        raise _http(400, str(exc)) from exc


@router.get("/{expense_id}", response_model=OtherExpenseResponse)
async def get_other_expense(
    expense_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_by_id(tenant_id, expense_id)
    except NotFoundError as exc:
        raise _http(404, str(exc)) from exc


@router.put("/{expense_id}", response_model=OtherExpenseResponse)
async def update_other_expense(
    expense_id: int,
    body: OtherExpenseUpdate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_expense(tenant_id, expense_id, body, current_user.id)
    except (NotFoundError, ValidationError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_other_expense(
    expense_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_expense(tenant_id, expense_id)
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{expense_id}/submit", response_model=OtherExpenseResponse)
async def submit_other_expense(
    expense_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:submit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit_expense(tenant_id, expense_id, current_user.id)
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{expense_id}/approve", response_model=OtherExpenseResponse)
async def approve_other_expense(
    expense_id: int,
    body: ReviewActionBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:approve")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_expense(
            tenant_id,
            expense_id,
            approved=body.approved,
            operator_id=current_user.id,
            review_remarks=body.review_remarks,
        )
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{expense_id}/reject", response_model=OtherExpenseResponse)
async def reject_other_expense(
    expense_id: int,
    body: ReviewActionBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:reject")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_expense(
            tenant_id,
            expense_id,
            approved=False,
            operator_id=current_user.id,
            review_remarks=body.review_remarks,
        )
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{expense_id}/confirm", response_model=OtherExpenseResponse)
async def confirm_other_expense(
    expense_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await posting.post_other_expense(
            tenant_id, expense_id, operator=current_user
        )
        return await service.get_by_id(tenant_id, expense_id)
    except (NotFoundError, ValidationError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{expense_id}/unconfirm", response_model=OtherExpenseResponse)
async def unconfirm_other_expense(
    expense_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await posting.unpost_other_expense(
            tenant_id, expense_id, operator_id=current_user.id
        )
        return await service.get_by_id(tenant_id, expense_id)
    except (NotFoundError, ValidationError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{expense_id}/cancel", response_model=OtherExpenseResponse)
async def cancel_other_expense(
    expense_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-expense:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.cancel_expense(tenant_id, expense_id, current_user.id)
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc
