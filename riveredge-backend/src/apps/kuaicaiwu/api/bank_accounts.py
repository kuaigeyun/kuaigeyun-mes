"""
银行账户 API
"""

from datetime import date, datetime
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
    tags=["App - Kuaicaiwu - Bank Accounts"],
    dependencies=[Depends(require_kuaicaiwu_module_access("bank-account"))],
)
service = BankAccountService()


class BankAccountCreate(BaseSchema):
    account_code: str = Field(..., max_length=50)
    account_name: str = Field(..., max_length=200)
    account_type: str = Field("bank", max_length=20, description="bank=银行账户 cash=库存现金")
    bank_name: Optional[str] = Field(None, max_length=200, description="开户行（银行账户必填）")
    account_number: Optional[str] = Field(None, max_length=64, description="银行账号（银行账户必填）")
    currency: str = Field("CNY", max_length=10)
    opening_balance: Decimal = Field(Decimal("0"))
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class BankAccountUpdate(BaseSchema):
    account_name: Optional[str] = None
    account_type: Optional[str] = Field(None, description="bank=银行账户 cash=库存现金")
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class BankAccountResponse(BaseSchema):
    id: int
    tenant_id: int
    account_code: str
    account_name: str
    account_type: str = "bank"
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    currency: str = "CNY"
    opening_balance: Decimal = Decimal("0")
    current_balance: Decimal
    is_active: bool
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class BankAccountListResponse(BaseSchema):
    items: List[BankAccountResponse]
    total: int
    skip: int
    limit: int


@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(
    data: BankAccountCreate,
    current_user: Any = Depends(get_current_user),
):
    try:
        row = await service.create(
            current_user.tenant_id,
            current_user=current_user,
            # BaseSchema.audit 为响应专用派生字段，不属于创建参数
            **data.model_dump(exclude={"audit"}),
        )
        return BankAccountResponse.model_validate(row)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("", response_model=BankAccountListResponse)
async def list_bank_accounts(
    skip: int = Query(0, ge=0),
    # 销售/采购订单等下拉需一次拉全量启用账户；上限与前端 dropdown 一致
    limit: int = Query(50, ge=1, le=500),
    is_active: Optional[bool] = None,
    keyword: Optional[str] = Query(None),
    account_code: Optional[str] = Query(None),
    account_name: Optional[str] = Query(None),
    bank_name: Optional[str] = Query(None),
    account_number: Optional[str] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    current_user: Any = Depends(get_current_user),
):
    rows, total = await service.list_accounts(
        current_user.tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active,
        keyword=keyword,
        account_code=account_code,
        account_name=account_name,
        bank_name=bank_name,
        account_number=account_number,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        sort_field=sort_field,
        sort_order=sort_order,
    )
    return BankAccountListResponse(
        items=[BankAccountResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


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
            current_user=current_user,
            **data.model_dump(exclude_unset=True),
        )
        return BankAccountResponse.model_validate(row)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class BankTransactionListResponse(BaseSchema):
    items: List[BankTransactionResponse]
    total: int
    skip: int
    limit: int


@router.get("/{account_id}/transactions", response_model=BankTransactionListResponse)
async def list_bank_transactions(
    account_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    source_doc_code: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    transaction_date_start: Optional[str] = Query(None),
    transaction_date_end: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    current_user: Any = Depends(get_current_user),
):
    await service.get_by_id(current_user.tenant_id, account_id)
    rows, total = await service.list_transactions(
        current_user.tenant_id,
        bank_account_id=account_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        source_doc_code=source_doc_code,
        direction=direction,
        transaction_date_start=transaction_date_start,
        transaction_date_end=transaction_date_end,
        sort_field=sort_field,
        sort_order=sort_order,
    )
    return BankTransactionListResponse(
        items=[BankTransactionResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


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
