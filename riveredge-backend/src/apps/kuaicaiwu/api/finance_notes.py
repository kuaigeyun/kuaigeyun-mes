"""
票据台账 API（应收 / 应付共用实现）
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import Field

from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from apps.kuaicaiwu.services.finance_note_service import FinanceNoteService
from core.api.deps.deps import get_current_user
from core.schemas.base import BaseSchema
from infra.exceptions.exceptions import NotFoundError, ValidationError

service = FinanceNoteService()


class FinanceNoteCreate(BaseSchema):
    bill_type: str = Field(
        ...,
        description="bank_acceptance/commercial_acceptance/bank_draft/bank_promissory_note/cheque",
    )
    bill_no: str = Field(..., max_length=100)
    amount: Decimal = Field(..., gt=0)
    issue_date: date
    due_date: date
    drawer_name: Optional[str] = None
    acceptor_name: Optional[str] = None
    payee_name: Optional[str] = None
    accepting_bank: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    receipt_id: Optional[int] = None
    payment_id: Optional[int] = None
    receivable_id: Optional[int] = None
    payable_id: Optional[int] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None


class FinanceNoteUpdate(BaseSchema):
    bill_type: Optional[str] = None
    bill_no: Optional[str] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    drawer_name: Optional[str] = None
    acceptor_name: Optional[str] = None
    payee_name: Optional[str] = None
    accepting_bank: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    receipt_id: Optional[int] = None
    payment_id: Optional[int] = None
    receivable_id: Optional[int] = None
    payable_id: Optional[int] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None


class FinanceNoteActionRequest(BaseSchema):
    action: str = Field(..., description="endorse/discount/collect/dishonor/honor")
    endorse_to_name: Optional[str] = None
    discount_bank: Optional[str] = None
    discount_date: Optional[date] = None
    discount_interest: Optional[Decimal] = None
    settle_date: Optional[date] = None


class FinanceNoteResponse(BaseSchema):
    id: int
    tenant_id: int
    direction: str
    bill_type: str
    note_code: str
    bill_no: str
    amount: Decimal
    issue_date: date
    due_date: date
    drawer_name: Optional[str] = None
    acceptor_name: Optional[str] = None
    payee_name: Optional[str] = None
    accepting_bank: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    receipt_id: Optional[int] = None
    payment_id: Optional[int] = None
    receivable_id: Optional[int] = None
    payable_id: Optional[int] = None
    status: str
    endorse_to_name: Optional[str] = None
    discount_bank: Optional[str] = None
    discount_date: Optional[date] = None
    discount_interest: Optional[Decimal] = None
    settle_date: Optional[date] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class FinanceNoteListResponse(BaseSchema):
    items: List[FinanceNoteResponse]
    total: int
    skip: int
    limit: int


def build_finance_notes_router(
    *,
    prefix: str,
    module_code: str,
    direction: str,
    tag: str,
) -> APIRouter:
    router = APIRouter(
        prefix=prefix,
        tags=[tag],
        dependencies=[Depends(require_kuaicaiwu_module_access(module_code))],
    )

    @router.post("", response_model=FinanceNoteResponse, status_code=status.HTTP_201_CREATED)
    async def create_note(data: FinanceNoteCreate, current_user: Any = Depends(get_current_user)):
        try:
            row = await service.create(
                current_user.tenant_id,
                direction=direction,
                current_user=current_user,
                **data.model_dump(exclude={"audit"}),
            )
            return FinanceNoteResponse.model_validate(row)
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @router.get("", response_model=FinanceNoteListResponse)
    async def list_notes(
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=500),
        keyword: Optional[str] = Query(None),
        status: Optional[str] = Query(None),
        bill_type: Optional[str] = Query(None),
        expiring_within_days: Optional[int] = Query(None, ge=0, le=365),
        due_date_start: Optional[str] = Query(None),
        due_date_end: Optional[str] = Query(None),
        partner_id: Optional[int] = Query(None),
        receipt_id: Optional[int] = Query(None),
        payment_id: Optional[int] = Query(None),
        unlinked_only: bool = Query(False),
        sort_field: Optional[str] = Query(None),
        sort_order: Optional[str] = Query(None),
        current_user: Any = Depends(get_current_user),
    ):
        rows, total = await service.list_notes(
            current_user.tenant_id,
            direction=direction,
            skip=skip,
            limit=limit,
            keyword=keyword,
            status=status,
            bill_type=bill_type,
            expiring_within_days=expiring_within_days,
            due_date_start=due_date_start,
            due_date_end=due_date_end,
            partner_id=partner_id,
            receipt_id=receipt_id,
            payment_id=payment_id,
            unlinked_only=unlinked_only,
            sort_field=sort_field,
            sort_order=sort_order,
        )
        return FinanceNoteListResponse(
            items=[FinanceNoteResponse.model_validate(r) for r in rows],
            total=total,
            skip=skip,
            limit=limit,
        )

    @router.get("/{note_id}", response_model=FinanceNoteResponse)
    async def get_note(note_id: int, current_user: Any = Depends(get_current_user)):
        try:
            row = await service.get_by_id(current_user.tenant_id, note_id, direction=direction)
            return FinanceNoteResponse.model_validate(row)
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    @router.put("/{note_id}", response_model=FinanceNoteResponse)
    async def update_note(
        note_id: int,
        data: FinanceNoteUpdate,
        current_user: Any = Depends(get_current_user),
    ):
        try:
            row = await service.update_fields(
                current_user.tenant_id,
                note_id,
                direction=direction,
                current_user=current_user,
                **data.model_dump(exclude_unset=True),
            )
            return FinanceNoteResponse.model_validate(row)
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @router.put("/{note_id}/action", response_model=FinanceNoteResponse)
    async def apply_note_action(
        note_id: int,
        data: FinanceNoteActionRequest,
        current_user: Any = Depends(get_current_user),
    ):
        try:
            row = await service.apply_action(
                current_user.tenant_id,
                note_id,
                direction=direction,
                current_user=current_user,
                **data.model_dump(exclude_unset=True),
            )
            return FinanceNoteResponse.model_validate(row)
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_note(note_id: int, current_user: Any = Depends(get_current_user)):
        try:
            await service.delete(current_user.tenant_id, note_id, direction=direction)
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    return router


notes_receivable_router = build_finance_notes_router(
    prefix="/notes-receivable",
    module_code="notes-receivable",
    direction="receivable",
    tag="App - Kuaicaiwu - Notes Receivable",
)

notes_payable_router = build_finance_notes_router(
    prefix="/notes-payable",
    module_code="notes-payable",
    direction="payable",
    tag="App - Kuaicaiwu - Notes Payable",
)
