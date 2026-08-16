"""税务管理 API。"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import Field

from apps.kuaicaiwu.services.tax.purchase_invoice_tax_service import PurchaseInvoiceTaxService
from apps.kuaicaiwu.services.tax.tax_coa_service import TaxCoaService
from apps.kuaicaiwu.services.tax.tax_settings_service import TaxSettingsService
from apps.kuaicaiwu.services.tax.tax_voucher_service import TaxVoucherService
from apps.kuaicaiwu.services.tax.vat_ledger_service import VatLedgerService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.schemas.base import BaseSchema
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/tax",
    tags=["App - Kuaicaiwu - Tax"],
)

settings_service = TaxSettingsService()
coa_service = TaxCoaService()
ledger_service = VatLedgerService()
voucher_service = TaxVoucherService()
purchase_tax_service = PurchaseInvoiceTaxService()


def _http_error(exc: Exception):
    from fastapi import HTTPException

    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, BusinessLogicError):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


class TaxSettingsUpdateBody(BaseSchema):
    taxpayer_type: Optional[str] = None
    tax_rates: Optional[List[Dict[str, Any]]] = None
    surcharge_rates: Optional[Dict[str, float]] = None
    account_bindings: Optional[Dict[str, Optional[int]]] = None


class BatchCertifyBody(BaseSchema):
    invoice_ids: List[int] = Field(..., min_length=1)
    verification_date: Optional[date] = None


class TransferOutBody(BaseSchema):
    reason: str = Field(..., min_length=1)
    verification_date: Optional[date] = None


class RedFlushBody(BaseSchema):
    reason: str = Field(..., min_length=1)


class PeriodBody(BaseSchema):
    year: int = Field(..., ge=2000, le=2100)
    month: int = Field(..., ge=1, le=12)


@router.get("/settings")
async def get_tax_settings(
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await settings_service.get_or_create(tenant_id)
    return settings_service.to_dict(row)


@router.put("/settings")
async def update_tax_settings(
    body: TaxSettingsUpdateBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await settings_service.update_settings(tenant_id, body.model_dump(exclude_unset=True))
        return settings_service.to_dict(row)
    except ValidationError as exc:
        raise _http_error(exc) from exc


@router.post("/settings/supplement-coa")
async def supplement_tax_coa(
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await coa_service.supplement_tax_accounts(tenant_id)
    except ValidationError as exc:
        raise _http_error(exc) from exc


@router.get("/vat-ledger")
async def get_vat_ledger(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await ledger_service.summarize_period(tenant_id, year, month)


@router.get("/vat-ledger/invoices")
async def list_vat_ledger_invoices(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    kind: str = Query(..., pattern="^(output|input|transfer_out)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await ledger_service.list_drill_invoices(
        tenant_id, year, month, kind=kind, skip=skip, limit=limit
    )


@router.get("/vat-ledger/print")
async def get_vat_ledger_print(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:export")),
    tenant_id: int = Depends(get_current_tenant),
):
    summary = await ledger_service.summarize_period(tenant_id, year, month)
    return {"summary": summary, "unit": "元"}


@router.post("/vat-ledger/vat-voucher")
async def create_vat_transfer_voucher(
    body: PeriodBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await voucher_service.generate_vat_transfer_voucher(
            tenant_id, body.year, body.month, current_user.id
        )
    except (ValidationError, BusinessLogicError) as exc:
        raise _http_error(exc) from exc


@router.post("/vat-ledger/surcharge-voucher")
async def create_surcharge_voucher(
    body: PeriodBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await voucher_service.generate_surcharge_voucher(
            tenant_id, body.year, body.month, current_user.id
        )
    except (ValidationError, BusinessLogicError) as exc:
        raise _http_error(exc) from exc


@router.post("/vat-ledger/lock")
async def lock_tax_period(
    body: PeriodBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await voucher_service.lock_tax_period(
        tenant_id, body.year, body.month, current_user.id
    )


@router.get("/input-certification")
async def list_pending_certification(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    verification_status: Optional[str] = Query("pending"),
    keyword: Optional[str] = None,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
    from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService

    svc = PurchaseInvoiceService()
    invoices, total = await svc.list_purchase_invoices(
        tenant_id,
        skip,
        limit,
        verification_status=verification_status,
        status="已审核",
        keyword=keyword,
    )
    return {"items": invoices, "total": total, "skip": skip, "limit": limit}


@router.post("/purchase-invoices/{invoice_id}/certify", status_code=status.HTTP_200_OK)
async def certify_purchase_invoice(
    invoice_id: int,
    verification_date: Optional[date] = None,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        inv = await purchase_tax_service.certify(
            tenant_id, invoice_id, verification_date=verification_date
        )
        return {"id": inv.id, "verification_status": inv.verification_status, "verification_date": str(inv.verification_date)}
    except (ValidationError, NotFoundError, BusinessLogicError) as exc:
        raise _http_error(exc) from exc


@router.post("/purchase-invoices/batch-certify", status_code=status.HTTP_200_OK)
async def batch_certify_purchase_invoices(
    body: BatchCertifyBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await purchase_tax_service.batch_certify(
        tenant_id, body.invoice_ids, verification_date=body.verification_date
    )


@router.post("/purchase-invoices/{invoice_id}/transfer-out", status_code=status.HTTP_200_OK)
async def transfer_out_purchase_invoice(
    invoice_id: int,
    body: TransferOutBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        inv = await purchase_tax_service.transfer_out(
            tenant_id, invoice_id, body.reason, verification_date=body.verification_date
        )
        return {"id": inv.id, "verification_status": inv.verification_status}
    except (ValidationError, NotFoundError, BusinessLogicError) as exc:
        raise _http_error(exc) from exc


@router.post("/purchase-invoices/{invoice_id}/red-flush", status_code=status.HTTP_201_CREATED)
async def red_flush_purchase_invoice(
    invoice_id: int,
    body: RedFlushBody,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:tax:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        inv = await purchase_tax_service.create_red_flush(
            tenant_id, invoice_id, body.reason, created_by=current_user.id
        )
        return {"id": inv.id, "invoice_code": inv.invoice_code, "original_invoice_id": inv.original_invoice_id}
    except (ValidationError, NotFoundError, BusinessLogicError) as exc:
        raise _http_error(exc) from exc
