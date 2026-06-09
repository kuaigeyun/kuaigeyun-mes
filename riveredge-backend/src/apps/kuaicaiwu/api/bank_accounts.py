"""
银行账户 API
"""

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import Field

from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from apps.kuaicaiwu.services.bank_account_service import BankAccountService
from core.api.deps.deps import get_current_user
from core.schemas.base import BaseSchema
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/bank-accounts",
    tags=["App · Kuaicaiwu · Bank Accounts"],
    dependencies=[Depends(require_kuaicaiwu_module_access("bank-account"))],
)
service = BankAccountService()


class BankAccountCreate(BaseSchema):
    account_code: str = Field(..., max_length=50)
    account_name: str = Field(..., max_length=200)
    bank_name: str = Field(..., max_length=200)
    account_number: str = Field(..., max_length=64)
    currency: str = Field("CNY", max_length=10)
    opening_balance: Decimal = Field(Decimal("0"))
    notes: Optional[str] = None


class BankAccountUpdate(BaseSchema):
    account_name: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class BankAccountResponse(BankAccountCreate):
    id: int
    tenant_id: int
    current_balance: Decimal
    is_active: bool

    class Config:
        from_attributes = True


@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(
    data: BankAccountCreate,
    current_user: Any = Depends(get_current_user),
):
    try:
        row = await service.create(current_user.tenant_id, **data.model_dump())
        return BankAccountResponse.model_validate(row)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("", response_model=List[BankAccountResponse])
async def list_bank_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: Optional[bool] = None,
    current_user: Any = Depends(get_current_user),
):
    rows = await service.list_accounts(
        current_user.tenant_id, skip=skip, limit=limit, is_active=is_active
    )
    return [BankAccountResponse.model_validate(r) for r in rows]


@router.get("/{account_id}", response_model=BankAccountResponse)
async def get_bank_account(account_id: int, current_user: Any = Depends(get_current_user)):
    try:
        row = await service.get_by_id(current_user.tenant_id, account_id)
        return BankAccountResponse.model_validate(row)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/{account_id}", response_model=BankAccountResponse)
async def update_bank_account(
    account_id: int,
    data: BankAccountUpdate,
    current_user: Any = Depends(get_current_user),
):
    try:
        row = await service.update(
            current_user.tenant_id,
            account_id,
            **data.model_dump(exclude_unset=True),
        )
        return BankAccountResponse.model_validate(row)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_account(account_id: int, current_user: Any = Depends(get_current_user)):
    try:
        await service.delete(current_user.tenant_id, account_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class BankTransactionResponse(BaseSchema):
    id: int
    bank_account_id: int
    transaction_date: date
    direction: str
    amount: Decimal
    balance_after: Decimal
    source_doc_type: Optional[str] = None
    source_doc_id: Optional[int] = None
    source_doc_code: Optional[str] = None
    summary: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/{account_id}/transactions", response_model=List[BankTransactionResponse])
async def list_bank_transactions(
    account_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: Any = Depends(get_current_user),
):
    await service.get_by_id(current_user.tenant_id, account_id)
    rows = await service.list_transactions(
        current_user.tenant_id,
        bank_account_id=account_id,
        skip=skip,
        limit=limit,
    )
    return [BankTransactionResponse.model_validate(r) for r in rows]


class ImportStatementRequest(BaseSchema):
    csv_content: str = Field(..., description="CSV 内容，表头含 transaction_date,direction,amount,summary")


@router.post("/{account_id}/import-statement")
async def import_bank_statement(
    account_id: int,
    data: ImportStatementRequest,
    current_user: Any = Depends(get_current_user),
):
    try:
        return await service.import_statement_csv(
            current_user.tenant_id, account_id, data.csv_content
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
