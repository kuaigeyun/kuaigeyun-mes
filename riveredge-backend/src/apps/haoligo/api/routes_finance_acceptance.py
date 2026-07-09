"""好力 GO — 财务材料验收单 API。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone

from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.finance_invoice import (
    HaoligoFinanceAcceptanceInvoice,
    HaoligoFinanceMaterialAcceptance,
    HaoligoFinanceMaterialAcceptanceLine,
)
from apps.haoligo.services.finance_material_acceptance import (
    confirm_material_acceptance,
    create_material_acceptance_from_invoices,
    get_or_create_acceptance_for_invoice,
)
from apps.haoligo.services.finance_supplier_price import get_supplier_or_404
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/finance/material-acceptances",
    tags=["App · HaoliGO · 财务管理 · 材料验收"],
    dependencies=[Depends(require_haoligo_module_access("finance-invoice-verify"))],
)


class FinanceAcceptanceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    line_no: int
    material_code: str
    material_name: str
    spec: Optional[str] = None
    unit: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    source_invoice_line_ids: Optional[list[int]] = None


class FinanceAcceptanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: str
    supplier_id: int
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    acceptance_date: Optional[date] = None
    total_amount: Decimal
    status: str
    reject_reason: Optional[str] = None
    remark: Optional[str] = None
    pdf_file_uuid: Optional[str] = None
    invoice_ids: List[int] = Field(default_factory=list)
    lines: List[FinanceAcceptanceLineOut] = Field(default_factory=list)


class FinanceAcceptanceCreate(BaseModel):
    invoice_ids: List[int] = Field(min_length=1)
    acceptance_date: Optional[date] = None
    remark: Optional[str] = None


async def _serialize_acceptance(row: HaoligoFinanceMaterialAcceptance, *, with_lines: bool = True) -> FinanceAcceptanceOut:
    supplier = await get_supplier_or_404(row.tenant_id, row.supplier_id)
    links = await HaoligoFinanceAcceptanceInvoice.filter(
        tenant_id=row.tenant_id, acceptance_id=row.id, deleted_at__isnull=True
    ).all()
    lines: list[FinanceAcceptanceLineOut] = []
    if with_lines:
        line_rows = await HaoligoFinanceMaterialAcceptanceLine.filter(
            tenant_id=row.tenant_id, acceptance_id=row.id, deleted_at__isnull=True
        ).order_by("line_no", "id")
        lines = [FinanceAcceptanceLineOut.model_validate(ln) for ln in line_rows]
    return FinanceAcceptanceOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        supplier_id=row.supplier_id,
        supplier_code=supplier.supplier_code,
        supplier_name=supplier.supplier_name,
        acceptance_date=row.acceptance_date,
        total_amount=row.total_amount,
        status=row.status,
        reject_reason=row.reject_reason,
        remark=row.remark,
        pdf_file_uuid=row.pdf_file_uuid,
        invoice_ids=[lk.invoice_id for lk in links],
        lines=lines,
    )


@router.get("", response_model=List[FinanceAcceptanceOut], summary="材料验收单列表")
async def list_finance_acceptances(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    qs = tenant_alive(HaoligoFinanceMaterialAcceptance, tenant_id)
    if supplier_id is not None:
        qs = qs.filter(supplier_id=supplier_id)
    if status and status.strip():
        qs = qs.filter(status=status.strip())
    rows = await qs.order_by("-created_at").offset(skip).limit(limit)
    return [await _serialize_acceptance(r, with_lines=False) for r in rows]


@router.get("/{acceptance_id}", response_model=FinanceAcceptanceOut, summary="材料验收单详情")
async def get_finance_acceptance(
    acceptance_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoFinanceMaterialAcceptance, tenant_id).filter(id=acceptance_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="验收单不存在")
    return await _serialize_acceptance(row, with_lines=True)


@router.post("", response_model=FinanceAcceptanceOut, summary="多发票合并生成验收单")
async def create_finance_acceptance(
    body: FinanceAcceptanceCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    acceptance = await create_material_acceptance_from_invoices(
        tenant_id,
        invoice_ids=body.invoice_ids,
        acceptance_date=body.acceptance_date,
        remark=body.remark,
    )
    return await _serialize_acceptance(acceptance, with_lines=True)


@router.post(
    "/from-invoice/{invoice_id}",
    response_model=FinanceAcceptanceOut,
    summary="按发票获取或生成验收单（用于打印）",
)
async def get_or_create_acceptance_from_invoice(
    invoice_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    acceptance = await get_or_create_acceptance_for_invoice(tenant_id, invoice_id)
    return await _serialize_acceptance(acceptance, with_lines=True)


@router.post("/{acceptance_id}/confirm", response_model=FinanceAcceptanceOut, summary="确认验收单")
async def confirm_finance_acceptance(
    acceptance_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    acceptance = await confirm_material_acceptance(tenant_id, acceptance_id)
    return await _serialize_acceptance(acceptance, with_lines=True)


@router.post("/{acceptance_id}/save-pdf", response_model=FinanceAcceptanceOut, summary="生成并保存验收单 PDF")
async def save_finance_acceptance_pdf(
    acceptance_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    import base64

    from core.services.file.file_service import FileService
    from apps.haoligo.services.print_service import HaoligoDocumentPrintService

    row = await tenant_alive(HaoligoFinanceMaterialAcceptance, tenant_id).filter(id=acceptance_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="验收单不存在")

    print_user = (user.full_name or user.username or "").strip()
    svc = HaoligoDocumentPrintService()
    result = await svc.print_document(
        tenant_id=tenant_id,
        document_type="finance_material_acceptance",
        document_id=acceptance_id,
        output_format="pdf",
        print_user=print_user,
    )
    raw_b64 = result.get("content") or ""
    if not raw_b64:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="PDF 生成失败")
    pdf_bytes = base64.b64decode(raw_b64)
    filename = f"材料验收单-{row.sheet_no}.pdf"
    file_obj = await FileService.save_uploaded_file(
        tenant_id=tenant_id,
        file_content=pdf_bytes,
        original_name=filename,
        category="haoligo_finance_acceptance",
        tags=["haoligo", "finance", "material_acceptance"],
        description=f"材料验收单 PDF · {row.sheet_no}",
    )
    row.pdf_file_uuid = file_obj.uuid
    await row.save()
    return await _serialize_acceptance(row, with_lines=True)


@router.delete("/{acceptance_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除草稿验收单")
async def delete_finance_acceptance(
    acceptance_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    from apps.haoligo.constants.finance_invoice import FINANCE_ACCEPTANCE_STATUS_DRAFT

    row = await tenant_alive(HaoligoFinanceMaterialAcceptance, tenant_id).filter(id=acceptance_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="验收单不存在")
    if row.status != FINANCE_ACCEPTANCE_STATUS_DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅草稿验收单可删除")
    row.deleted_at = timezone.now()
    await row.save()
