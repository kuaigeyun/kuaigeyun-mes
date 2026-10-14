"""其他费用收入 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaizhizao.schemas.other_voucher import (
    OtherIncomeCreate,
    OtherIncomeResponse,
    OtherIncomeUpdate,
    ReviewActionBody,
)
from apps.kuaizhizao.services.misc_voucher_posting_service import MiscVoucherPostingService
from apps.kuaizhizao.services.other_income_service import OtherIncomeService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/other-incomes", tags=["App - Kuaizhizao - Other Income"])
service = OtherIncomeService()
posting = MiscVoucherPostingService()


def _http(status_code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)


@router.get("", response_model=dict)
async def list_other_incomes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_incomes(
        tenant_id, skip=skip, limit=limit, status=status, keyword=keyword
    )


@router.post("", response_model=OtherIncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_other_income(
    body: OtherIncomeCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_income(tenant_id, body, current_user.id)
    except (ValidationError, BusinessLogicError) as exc:
        raise _http(400, str(exc)) from exc


@router.get("/{income_id}", response_model=OtherIncomeResponse)
async def get_other_income(
    income_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_by_id(tenant_id, income_id)
    except NotFoundError as exc:
        raise _http(404, str(exc)) from exc


@router.put("/{income_id}", response_model=OtherIncomeResponse)
async def update_other_income(
    income_id: int,
    body: OtherIncomeUpdate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_income(tenant_id, income_id, body, current_user.id)
    except (NotFoundError, ValidationError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_other_income(
    income_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_income(tenant_id, income_id)
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{income_id}/submit", response_model=OtherIncomeResponse)
async def submit_other_income(
    income_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:submit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit_income(tenant_id, income_id, current_user.id)
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{income_id}/approve", response_model=OtherIncomeResponse)
async def approve_other_income(
    income_id: int,
    body: ReviewActionBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:approve")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_income(
            tenant_id,
            income_id,
            approved=body.approved,
            operator_id=current_user.id,
            review_remarks=body.review_remarks,
        )
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{income_id}/reject", response_model=OtherIncomeResponse)
async def reject_other_income(
    income_id: int,
    body: ReviewActionBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:reject")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_income(
            tenant_id,
            income_id,
            approved=False,
            operator_id=current_user.id,
            review_remarks=body.review_remarks,
        )
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{income_id}/confirm", response_model=OtherIncomeResponse)
async def confirm_other_income(
    income_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await posting.post_other_income(
            tenant_id, income_id, operator=current_user
        )
        return await service.get_by_id(tenant_id, income_id)
    except (NotFoundError, ValidationError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{income_id}/unconfirm", response_model=OtherIncomeResponse)
async def unconfirm_other_income(
    income_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await posting.unpost_other_income(
            tenant_id, income_id, operator_id=current_user.id
        )
        return await service.get_by_id(tenant_id, income_id)
    except (NotFoundError, ValidationError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc


@router.post("/{income_id}/cancel", response_model=OtherIncomeResponse)
async def cancel_other_income(
    income_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:other-income:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.cancel_income(tenant_id, income_id, current_user.id)
    except (NotFoundError, BusinessLogicError) as exc:
        code = 404 if isinstance(exc, NotFoundError) else 400
        raise _http(code, str(exc)) from exc
