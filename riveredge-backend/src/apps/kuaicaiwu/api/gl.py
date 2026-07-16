"""
总账 API：科目、凭证、关账、导出
"""

from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from pydantic import Field

from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.models.voucher_line import VoucherLine
from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from apps.kuaicaiwu.services.period_close_service import PeriodCloseService
from apps.kuaicaiwu.services.posting_service import PostingService
from apps.kuaicaiwu.services.voucher_export_service import VoucherExportService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_user
from core.schemas.base import BaseSchema
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/gl",
    tags=["App - Kuaicaiwu - General Ledger"],
    dependencies=[Depends(require_kuaicaiwu_module_access("gl"))],
)
posting_service = PostingService()
period_service = PeriodCloseService()
export_service = VoucherExportService()


class ChartOfAccountCreate(BaseSchema):
    account_code: str = Field(..., max_length=32)
    account_name: str = Field(..., max_length=200)
    account_type: str = Field(..., max_length=20)
    parent_id: Optional[int] = None
    balance_direction: str = Field("debit", max_length=10)
    notes: Optional[str] = None


class ChartOfAccountResponse(ChartOfAccountCreate):
    id: int
    tenant_id: int
    level: int
    is_leaf: bool
    is_active: bool

    class Config:
        from_attributes = True


class VoucherResponse(BaseSchema):
    id: int
    tenant_id: int
    voucher_code: str
    voucher_date: date
    period_year: int
    period_month: int
    status: str
    summary: Optional[str]
    total_debit: float
    total_credit: float

    class Config:
        from_attributes = True


@router.post("/accounts", response_model=ChartOfAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(data: ChartOfAccountCreate, current_user: Any = Depends(get_current_user)):
    import uuid
    row = await ChartOfAccount.create(
        tenant_id=current_user.tenant_id,
        uuid=str(uuid.uuid4()),
        **data.model_dump(),
    )
    return ChartOfAccountResponse.model_validate(row)


@router.get("/accounts", response_model=List[ChartOfAccountResponse])
async def list_accounts(
    is_active: Optional[bool] = None,
    current_user: Any = Depends(get_current_user),
):
    q = ChartOfAccount.filter(tenant_id=current_user.tenant_id, deleted_at__isnull=True)
    if is_active is not None:
        q = q.filter(is_active=is_active)
    rows = await q.order_by("account_code").all()
    return [ChartOfAccountResponse.model_validate(r) for r in rows]


@router.post("/vouchers/from-event/{event_id}", response_model=VoucherResponse)
async def create_draft_voucher_from_event(
    event_id: int,
    current_user: Any = Depends(get_current_user),
):
    try:
        voucher = await posting_service.create_draft_voucher_from_event(
            current_user.tenant_id, event_id, current_user.id
        )
        return VoucherResponse.model_validate(voucher)
    except (NotFoundError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/vouchers", response_model=List[VoucherResponse])
async def list_vouchers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    current_user: Any = Depends(get_current_user),
):
    rows = await posting_service.list_vouchers(
        current_user.tenant_id, skip=skip, limit=limit, status=status
    )
    return [VoucherResponse.model_validate(r) for r in rows]


@router.post("/vouchers/{voucher_id}/post", response_model=VoucherResponse)
async def post_voucher(voucher_id: int, current_user: Any = Depends(get_current_user)):
    try:
        voucher = await posting_service.post_voucher(
            current_user.tenant_id, voucher_id, current_user.id
        )
        return VoucherResponse.model_validate(voucher)
    except (NotFoundError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/vouchers/{voucher_id}/lines")
async def list_voucher_lines(voucher_id: int, current_user: Any = Depends(get_current_user)):
    lines = await VoucherLine.filter(
        tenant_id=current_user.tenant_id, voucher_id=voucher_id
    ).order_by("line_no").all()
    return [
        {
            "line_no": l.line_no,
            "account_code": l.account_code,
            "account_name": l.account_name,
            "summary": l.summary,
            "debit_amount": float(l.debit_amount or 0),
            "credit_amount": float(l.credit_amount or 0),
        }
        for l in lines
    ]


@router.get("/vouchers/export/csv", response_class=PlainTextResponse)
async def export_vouchers_csv(
    status: Optional[str] = None,
    current_user: Any = Depends(get_current_user),
):
    csv_text = await export_service.export_vouchers_csv(
        current_user.tenant_id, status=status
    )
    return PlainTextResponse(content=csv_text, media_type="text/csv")


@router.get("/period-close/status")
async def period_close_status(current_user: Any = Depends(get_current_user)):
    return await period_service.get_period_status(current_user.tenant_id)


@router.post("/period-close/{year}/{month}")
async def close_period(
    year: int,
    month: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:gl:execute")),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await period_service.close_period(
            current_user.tenant_id, year, month, current_user.id
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
