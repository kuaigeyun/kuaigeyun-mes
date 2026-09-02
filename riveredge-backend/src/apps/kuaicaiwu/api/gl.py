"""
总账 API：科目、参数、期初、凭证、账簿、期末、出纳、业财对账
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from pydantic import Field

from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from apps.kuaicaiwu.models.voucher_summary import VoucherSummaryEntry
from apps.kuaicaiwu.services.gl import (
    BalanceService,
    CoaService,
    GlCashierService,
    GlIntegrationReconcileService,
    GlPeriodService,
    GlSettingsService,
    GlTransferService,
    StatementService,
)
from apps.kuaicaiwu.services.gl.phase2_service import GlPhase2Service
from apps.kuaicaiwu.services.posting_service import PostingService
from apps.kuaicaiwu.services.voucher_export_service import VoucherExportService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_user
from core.schemas.base import BaseSchema
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
import uuid

router = APIRouter(
    prefix="/gl",
    tags=["App - Kuaicaiwu - General Ledger"],
    dependencies=[Depends(require_kuaicaiwu_module_access("gl"))],
)

coa_service = CoaService()
settings_service = GlSettingsService()
period_service = GlPeriodService()
balance_service = BalanceService()
posting_service = PostingService()
transfer_service = GlTransferService()
cashier_service = GlCashierService()
integration_service = GlIntegrationReconcileService()
export_service = VoucherExportService()
phase2_service = GlPhase2Service()
statement_service = StatementService()


def _err(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


# ---------- schemas ----------


class ChartOfAccountBody(BaseSchema):
    account_code: str = Field(..., max_length=32)
    account_name: str = Field(..., max_length=200)
    account_type: str = Field(..., max_length=20)
    parent_id: Optional[int] = None
    balance_direction: str = Field("debit", max_length=10)
    is_leaf: bool = True
    is_cash_journal: bool = False
    is_bank_journal: bool = False
    is_controlled: bool = False
    aux_customer: bool = False
    aux_supplier: bool = False
    aux_department: bool = False
    aux_employee: bool = False
    aux_project: bool = False
    is_active: bool = True
    notes: Optional[str] = None


class VoucherLineBody(BaseSchema):
    account_id: Optional[int] = None
    account_code: Optional[str] = None
    summary: Optional[str] = None
    debit_amount: float = 0
    credit_amount: float = 0
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    cash_flow_item_id: Optional[int] = None


class VoucherBody(BaseSchema):
    voucher_word: str = "记"
    voucher_date: Optional[date] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    summary: Optional[str] = None
    attachment_count: int = 0
    lines: List[VoucherLineBody]


class OpeningBalanceItem(BaseSchema):
    account_id: int
    opening_debit: float = 0
    opening_credit: float = 0
    customer_id: Optional[int] = None
    supplier_id: Optional[int] = None
    department_id: Optional[int] = None
    employee_id: Optional[int] = None
    project_id: Optional[int] = None


class OpeningBalanceBody(BaseSchema):
    period_year: int
    period_month: int
    items: List[OpeningBalanceItem]


# ---------- settings / periods ----------


@router.get("/settings")
async def get_settings(current_user: Any = Depends(get_current_user)):
    row = await settings_service.get_or_create(current_user.tenant_id)
    return settings_service.to_dict(row)


@router.put("/settings")
async def update_settings(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    row = await settings_service.update_settings(current_user.tenant_id, body)
    return settings_service.to_dict(row)


@router.post("/settings/finish-init")
async def finish_init(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    try:
        row = await settings_service.finish_initialization(
            current_user.tenant_id, year=year, month=month, operator_id=current_user.id
        )
        return settings_service.to_dict(row)
    except (ValidationError, BusinessLogicError) as exc:
        raise _err(exc)


@router.get("/periods")
async def list_periods(
    year: Optional[int] = None,
    current_user: Any = Depends(get_current_user),
):
    return await period_service.get_status(current_user.tenant_id) if year is None else {
        "periods": [
            {
                "period_year": p.period_year,
                "period_month": p.period_month,
                "status": p.status,
            }
            for p in await period_service.list_periods(current_user.tenant_id, year)
        ]
    }


@router.get("/period-close/status")
async def period_close_status(current_user: Any = Depends(get_current_user)):
    return await period_service.get_status(current_user.tenant_id)


@router.get("/period-close/pre-checks")
async def period_pre_checks(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    return await period_service.pre_close_checks(current_user.tenant_id, year, month)


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
    except (ValidationError, BusinessLogicError, NotFoundError) as exc:
        raise _err(exc)


@router.post("/period-close/{year}/{month}/reopen")
async def reopen_period(
    year: int,
    month: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:gl:execute")),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await period_service.reopen_period(
            current_user.tenant_id, year, month, current_user.id
        )
    except (ValidationError, BusinessLogicError, NotFoundError) as exc:
        raise _err(exc)


# ---------- COA ----------


@router.get("/accounts")
async def list_accounts(
    is_active: Optional[bool] = None,
    account_type: Optional[str] = None,
    current_user: Any = Depends(get_current_user),
):
    rows = await coa_service.list_accounts(
        current_user.tenant_id, is_active=is_active, account_type=account_type
    )
    return [coa_service.to_dict(r) for r in rows]


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def create_account(body: ChartOfAccountBody, current_user: Any = Depends(get_current_user)):
    try:
        row = await coa_service.create_account(current_user.tenant_id, body.model_dump())
        return coa_service.to_dict(row)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: int,
    body: Dict[str, Any],
    current_user: Any = Depends(get_current_user),
):
    try:
        row = await coa_service.update_account(current_user.tenant_id, account_id, body)
        return coa_service.to_dict(row)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: int, current_user: Any = Depends(get_current_user)):
    try:
        await coa_service.delete_account(current_user.tenant_id, account_id)
        return {"success": True}
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.get("/accounts/seed-templates")
async def list_account_seed_templates(current_user: Any = Depends(get_current_user)):
    return {"items": coa_service.list_seed_templates()}


@router.post("/accounts/seed")
async def seed_accounts(
    template_key: str = Query(
        "cas_manufacturing",
        description="科目模板：cas_manufacturing / cas_commerce / cas_service / sbas_general",
    ),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await coa_service.seed_industry_template(current_user.tenant_id, template_key)
    except ValidationError as exc:
        raise _err(exc)


# ---------- opening ----------


@router.post("/opening-balances")
async def set_opening_balances(body: OpeningBalanceBody, current_user: Any = Depends(get_current_user)):
    try:
        return await balance_service.set_opening_balances(
            current_user.tenant_id,
            body.period_year,
            body.period_month,
            [i.model_dump() for i in body.items],
        )
    except ValidationError as exc:
        raise _err(exc)


@router.get("/opening-balances")
async def get_opening_balances(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    return await balance_service.account_balance_sheet(current_user.tenant_id, year, month)


# ---------- summaries ----------


@router.get("/summaries")
async def list_summaries(current_user: Any = Depends(get_current_user)):
    rows = await VoucherSummaryEntry.filter(
        tenant_id=current_user.tenant_id, deleted_at__isnull=True, is_active=True
    ).order_by("sort_order", "id")
    return [
        {"id": r.id, "content": r.content, "sort_order": r.sort_order}
        for r in rows
    ]


@router.post("/summaries", status_code=status.HTTP_201_CREATED)
async def create_summary(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    row = await VoucherSummaryEntry.create(
        tenant_id=current_user.tenant_id,
        uuid=str(uuid.uuid4()),
        content=str(body.get("content") or "").strip(),
        sort_order=int(body.get("sort_order") or 0),
    )
    return {"id": row.id, "content": row.content}


# ---------- vouchers ----------


@router.get("/vouchers")
async def list_vouchers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    period_year: Optional[int] = None,
    period_month: Optional[int] = None,
    keyword: Optional[str] = None,
    current_user: Any = Depends(get_current_user),
):
    rows = await posting_service.list_vouchers(
        current_user.tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        period_year=period_year,
        period_month=period_month,
        keyword=keyword,
    )
    return await posting_service.vouchers_to_list_dicts(current_user.tenant_id, rows)


@router.get("/vouchers/export/csv", response_class=PlainTextResponse)
async def export_vouchers_csv(
    status: Optional[str] = None,
    current_user: Any = Depends(get_current_user),
):
    csv_text = await export_service.export_vouchers_csv(
        current_user.tenant_id, status=status
    )
    return PlainTextResponse(content=csv_text, media_type="text/csv")


@router.post("/vouchers", status_code=status.HTTP_201_CREATED)
async def create_voucher(body: VoucherBody, current_user: Any = Depends(get_current_user)):
    try:
        voucher = await posting_service.create_manual_voucher(
            current_user.tenant_id,
            current_user.id,
            body.model_dump(),
        )
        return posting_service.voucher_to_dict(voucher)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.post("/vouchers/from-event/{event_id}")
async def create_draft_voucher_from_event(
    event_id: int,
    current_user: Any = Depends(get_current_user),
):
    try:
        voucher = await posting_service.create_draft_voucher_from_event(
            current_user.tenant_id, event_id, current_user.id
        )
        return posting_service.voucher_to_dict(voucher)
    except (NotFoundError, ValidationError) as exc:
        raise _err(exc)


@router.post("/vouchers/generate-from-events")
async def generate_from_events(
    limit: int = Query(50, ge=1, le=200),
    current_user: Any = Depends(get_current_user),
):
    return await integration_service.generate_vouchers_from_pending_events(
        current_user.tenant_id, current_user.id, limit=limit
    )


@router.get("/vouchers/{voucher_id}")
async def get_voucher(voucher_id: int, current_user: Any = Depends(get_current_user)):
    try:
        return await posting_service.get_voucher_detail(current_user.tenant_id, voucher_id)
    except NotFoundError as exc:
        raise _err(exc)


@router.put("/vouchers/{voucher_id}")
async def update_voucher(
    voucher_id: int,
    body: VoucherBody,
    current_user: Any = Depends(get_current_user),
):
    try:
        voucher = await posting_service.update_draft_voucher(
            current_user.tenant_id, voucher_id, body.model_dump()
        )
        return posting_service.voucher_to_dict(voucher)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.get("/vouchers/{voucher_id}/lines")
async def list_voucher_lines(voucher_id: int, current_user: Any = Depends(get_current_user)):
    detail = await posting_service.get_voucher_detail(current_user.tenant_id, voucher_id)
    return detail["lines"]


@router.post("/vouchers/{voucher_id}/review")
async def review_voucher(voucher_id: int, current_user: Any = Depends(get_current_user)):
    try:
        voucher = await posting_service.review_voucher(
            current_user.tenant_id, voucher_id, current_user.id
        )
        return posting_service.voucher_to_dict(voucher)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.post("/vouchers/{voucher_id}/unreview")
async def unreview_voucher(voucher_id: int, current_user: Any = Depends(get_current_user)):
    try:
        voucher = await posting_service.unreview_voucher(current_user.tenant_id, voucher_id)
        return posting_service.voucher_to_dict(voucher)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.post("/vouchers/{voucher_id}/post")
async def post_voucher(voucher_id: int, current_user: Any = Depends(get_current_user)):
    try:
        voucher = await posting_service.post_voucher(
            current_user.tenant_id, voucher_id, current_user.id
        )
        return posting_service.voucher_to_dict(voucher)
    except (ValidationError, NotFoundError, BusinessLogicError) as exc:
        raise _err(exc)


@router.post("/vouchers/{voucher_id}/unpost")
async def unpost_voucher(voucher_id: int, current_user: Any = Depends(get_current_user)):
    try:
        voucher = await posting_service.unpost_voucher(current_user.tenant_id, voucher_id)
        return posting_service.voucher_to_dict(voucher)
    except (ValidationError, NotFoundError, BusinessLogicError) as exc:
        raise _err(exc)


@router.post("/vouchers/{voucher_id}/obsolete")
async def obsolete_voucher(voucher_id: int, current_user: Any = Depends(get_current_user)):
    try:
        voucher = await posting_service.cancel_voucher(current_user.tenant_id, voucher_id)
        return posting_service.voucher_to_dict(voucher)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


# ---------- books ----------


@router.get("/books/balance-sheet")
async def book_balance_sheet(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    include_unposted: bool = False,
    account_code_from: Optional[str] = None,
    account_code_to: Optional[str] = None,
    customer_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    department_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    project_id: Optional[int] = None,
    aux_only: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await balance_service.account_balance_sheet(
        current_user.tenant_id,
        year,
        month,
        include_unposted=include_unposted,
        account_code_from=account_code_from,
        account_code_to=account_code_to,
        customer_id=customer_id,
        supplier_id=supplier_id,
        department_id=department_id,
        employee_id=employee_id,
        project_id=project_id,
        aux_only=aux_only,
    )


@router.get("/books/trial-balance")
async def book_trial_balance(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    include_unposted: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await balance_service.trial_balance(
        current_user.tenant_id, year, month, include_unposted=include_unposted
    )


@router.get("/books/detail-ledger")
async def book_detail_ledger(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    account_id: int = Query(...),
    include_unposted: bool = False,
    customer_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    department_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    project_id: Optional[int] = None,
    current_user: Any = Depends(get_current_user),
):
    try:
        return await balance_service.detail_ledger(
            current_user.tenant_id,
            year,
            month,
            account_id,
            include_unposted=include_unposted,
            customer_id=customer_id,
            supplier_id=supplier_id,
            department_id=department_id,
            employee_id=employee_id,
            project_id=project_id,
        )
    except ValidationError as exc:
        raise _err(exc)


@router.get("/books/general-ledger")
async def book_general_ledger(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    include_unposted: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await balance_service.general_ledger(
        current_user.tenant_id, year, month, include_unposted=include_unposted
    )


@router.get("/books/voucher-summary")
async def book_voucher_summary(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    include_unposted: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await balance_service.voucher_summary(
        current_user.tenant_id, year, month, include_unposted=include_unposted
    )


# ---------- transfer / PL ----------


@router.get("/transfer-templates")
async def list_transfer_templates(current_user: Any = Depends(get_current_user)):
    rows = await transfer_service.list_templates(current_user.tenant_id)
    return [
        {
            "id": r.id,
            "template_code": r.template_code,
            "template_name": r.template_name,
            "template_type": r.template_type,
            "lines": r.lines,
            "is_active": r.is_active,
        }
        for r in rows
    ]


@router.post("/transfer-templates")
async def upsert_transfer_template(
    body: Dict[str, Any],
    current_user: Any = Depends(get_current_user),
):
    try:
        row = await transfer_service.upsert_template(current_user.tenant_id, body)
        return {
            "id": row.id,
            "template_code": row.template_code,
            "template_name": row.template_name,
            "template_type": row.template_type,
            "lines": row.lines,
            "is_active": row.is_active,
        }
    except ValidationError as exc:
        raise _err(exc)


@router.post("/transfer-templates/{template_id}/run")
async def run_transfer_template(
    template_id: int,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await transfer_service.run_template(
            current_user.tenant_id, template_id, year, month, current_user.id
        )
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.post("/carry-profit-loss")
async def carry_profit_loss(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await transfer_service.run_profit_loss_transfer(
            current_user.tenant_id, year, month, current_user.id
        )
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


# ---------- cashier ----------


@router.get("/cashier/journal")
async def cashier_journal(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    kind: str = Query("bank"),
    account_id: Optional[int] = None,
    include_unposted: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await cashier_service.cash_bank_journal(
        current_user.tenant_id,
        year,
        month,
        kind=kind,
        account_id=account_id,
        include_unposted=include_unposted,
    )


@router.get("/cashier/reconcile-items")
async def list_reconcile_items(
    gl_account_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    side: Optional[str] = None,
    unmatched_only: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await cashier_service.list_reconcile_items(
        current_user.tenant_id,
        gl_account_id,
        year,
        month,
        side=side,
        unmatched_only=unmatched_only,
    )


@router.post("/cashier/reconcile-items")
async def add_reconcile_item(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    try:
        return await cashier_service.add_bank_statement_item(current_user.tenant_id, body)
    except ValidationError as exc:
        raise _err(exc)


@router.post("/cashier/sync-enterprise")
async def sync_enterprise(
    gl_account_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    return await cashier_service.sync_enterprise_from_journal(
        current_user.tenant_id, gl_account_id, year, month
    )


@router.post("/cashier/match")
async def match_reconcile(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    try:
        return await cashier_service.match_items(
            current_user.tenant_id, list(body.get("item_ids") or [])
        )
    except ValidationError as exc:
        raise _err(exc)


@router.get("/cashier/balance-adjustment")
async def balance_adjustment(
    gl_account_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    bank_balance: float = Query(0),
    current_user: Any = Depends(get_current_user),
):
    return await cashier_service.balance_adjustment_sheet(
        current_user.tenant_id,
        gl_account_id,
        year,
        month,
        bank_balance=bank_balance,
    )


# ---------- integration ----------


@router.get("/integration/month-end-checks")
async def month_end_checks(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    return await integration_service.month_end_checks(current_user.tenant_id, year, month)


# ---------- phase2: projects / cashflow / accrual / cheques ----------


@router.get("/projects")
async def list_projects(current_user: Any = Depends(get_current_user)):
    return await phase2_service.list_projects(current_user.tenant_id)


@router.post("/projects")
async def upsert_project(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    try:
        return await phase2_service.upsert_project(current_user.tenant_id, body)
    except ValidationError as exc:
        raise _err(exc)


@router.get("/cash-flow-items")
async def list_cash_flow_items(current_user: Any = Depends(get_current_user)):
    return await phase2_service.list_cash_flow_items(current_user.tenant_id)


@router.post("/cash-flow-items")
async def upsert_cash_flow_item(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    try:
        return await phase2_service.upsert_cash_flow_item(current_user.tenant_id, body)
    except ValidationError as exc:
        raise _err(exc)


@router.post("/cash-flow-items/seed")
async def seed_cash_flow_items(current_user: Any = Depends(get_current_user)):
    return await phase2_service.seed_cash_flow_items(current_user.tenant_id)


@router.get("/books/cash-flow")
async def book_cash_flow(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    return await phase2_service.cash_flow_statement(current_user.tenant_id, year, month)


@router.get("/statements/balance-sheet")
async def statutory_balance_sheet(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    include_unposted: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await statement_service.balance_sheet(
        current_user.tenant_id, year, month, include_unposted=include_unposted
    )


@router.get("/statements/income")
async def statutory_income_statement(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    include_unposted: bool = False,
    current_user: Any = Depends(get_current_user),
):
    return await statement_service.income_statement(
        current_user.tenant_id, year, month, include_unposted=include_unposted
    )


@router.get("/statements/cash-flow")
async def statutory_cash_flow(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    return await phase2_service.cash_flow_statement(current_user.tenant_id, year, month)


@router.get("/accruals")
async def list_accruals(current_user: Any = Depends(get_current_user)):
    return await phase2_service.list_accruals(current_user.tenant_id)


@router.post("/accruals")
async def upsert_accrual(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    try:
        return await phase2_service.upsert_accrual(current_user.tenant_id, body)
    except ValidationError as exc:
        raise _err(exc)


@router.post("/accruals/{accrual_id}/run")
async def run_accrual(
    accrual_id: int,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await phase2_service.run_accrual(
            current_user.tenant_id, accrual_id, year, month, current_user.id
        )
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.get("/cheques")
async def list_cheques(
    gl_account_id: Optional[int] = None,
    current_user: Any = Depends(get_current_user),
):
    return await phase2_service.list_cheques(current_user.tenant_id, gl_account_id=gl_account_id)


@router.post("/cheques")
async def create_cheque(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    try:
        return await phase2_service.create_cheque(current_user.tenant_id, body)
    except ValidationError as exc:
        raise _err(exc)


@router.post("/cheques/{cheque_id}/clear")
async def clear_cheque(cheque_id: int, current_user: Any = Depends(get_current_user)):
    try:
        return await phase2_service.clear_cheque(current_user.tenant_id, cheque_id)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.post("/cheques/{cheque_id}/void")
async def void_cheque(cheque_id: int, current_user: Any = Depends(get_current_user)):
    try:
        return await phase2_service.void_cheque(current_user.tenant_id, cheque_id)
    except (ValidationError, NotFoundError) as exc:
        raise _err(exc)


@router.post("/fa/record-event")
async def record_fa_event(body: Dict[str, Any], current_user: Any = Depends(get_current_user)):
    """固定资产钩子占位：写入折旧/处置会计事件，供「按事件生成」凭证。"""
    from apps.kuaicaiwu.services.finance_integration_hooks import record_finance_accounting_event
    from decimal import Decimal

    event_type = str(body.get("event_type") or "FA_DEPRECIATION")
    if event_type not in {"FA_DEPRECIATION", "FA_DISPOSAL", "FIXED_ASSET_DEPRECIATION", "FIXED_ASSET_DISPOSAL"}:
        raise HTTPException(status_code=400, detail="不支持的固定资产事件类型")
    try:
        await record_finance_accounting_event(
            tenant_id=current_user.tenant_id,
            event_type=event_type,
            business_type="fixed_asset",
            source_doc_type=str(body.get("source_doc_type") or "fixed_asset"),
            source_doc_id=int(body.get("source_doc_id") or 0),
            source_doc_code=body.get("source_doc_code"),
            target_doc_type=str(body.get("target_doc_type") or "fixed_asset"),
            target_doc_id=int(body.get("target_doc_id") or body.get("source_doc_id") or 0),
            target_doc_code=body.get("target_doc_code") or body.get("source_doc_code"),
            amount=Decimal(str(body.get("amount") or 0)) if body.get("amount") is not None else None,
            operator_id=current_user.id,
            notes=body.get("notes") or "固定资产总账钩子",
            payload=body.get("payload") or {},
        )
        return {"ok": True, "event_type": event_type}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
