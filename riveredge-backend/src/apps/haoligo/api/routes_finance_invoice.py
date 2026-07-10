"""好力 GO — 财务发票验票 API。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.finance_invoice import (
    FINANCE_INVOICE_LINE_STATUS_REJECTED,
    FINANCE_INVOICE_STATUS_PENDING,
    FINANCE_INVOICE_STATUS_REJECTED,
)
from apps.haoligo.constants.finance_supplier_price import FINANCE_PRICE_CHANGE_SOURCE_INVOICE_VERIFY
from apps.haoligo.models.finance_invoice import HaoligoFinanceInvoice, HaoligoFinanceInvoiceLine
from apps.haoligo.services.finance_einvoice_parser import (
    invoice_snapshot_for_json,
    parse_einvoice_pdf_bytes,
    parse_einvoice_qr_text,
    parse_structured_invoice_payload,
)
from apps.haoligo.services.finance_invoice_verify import verify_invoice_lines
from apps.haoligo.services.finance_supplier_price import (
    change_supplier_price,
    create_supplier_price_row,
    get_supplier_or_404,
    quick_add_supplier_price,
    resolve_supplier_by_name,
)
from apps.haoligo.utils.finance_decimal import parse_unit_price_decimal, resolve_unit_price_literal
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/finance/invoices",
    tags=["App · HaoliGO · 财务管理 · 验票"],
    dependencies=[Depends(require_haoligo_module_access("finance-invoice-verify"))],
)


class FinanceInvoiceLineIn(BaseModel):
    line_no: int = Field(default=1, ge=1)
    material_code: str = Field(max_length=64)
    material_name: str = Field(max_length=200)
    spec: Optional[str] = Field(None, max_length=200)
    unit: Optional[str] = Field(None, max_length=32)
    quantity: Decimal = Field(default=Decimal("0"), ge=0)
    invoice_unit_price: Decimal = Field(ge=0)
    invoice_unit_price_literal: Optional[str] = Field(None, exclude=True)
    tax_amount: Optional[Decimal] = None

    @model_validator(mode="before")
    @classmethod
    def capture_price_literal(cls, data):
        if isinstance(data, dict) and isinstance(data.get("invoice_unit_price"), str):
            data["invoice_unit_price_literal"] = data["invoice_unit_price"].strip().replace(",", "")
        return data

    @field_validator("material_code", "material_name", mode="before")
    @classmethod
    def strip_required(cls, v, info):
        s = str(v or "").strip()
        if not s:
            raise ValueError(f"{info.field_name} 不能为空")
        return s

    @field_validator("invoice_unit_price", mode="before")
    @classmethod
    def parse_invoice_unit_price(cls, v):
        return parse_unit_price_decimal(v)


class FinanceInvoiceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    line_no: int
    material_code: str
    material_name: str
    spec: Optional[str] = None
    unit: Optional[str] = None
    quantity: Decimal
    invoice_unit_price: Decimal
    invoice_unit_price_literal: Optional[str] = Field(None, exclude=True)
    tax_amount: Optional[Decimal] = None
    system_unit_price: Optional[Decimal] = None
    system_unit_price_literal: Optional[str] = Field(None, exclude=True)
    price_diff_amount: Optional[Decimal] = None
    price_diff_ratio: Optional[Decimal] = None
    line_status: str
    supplier_price_id: Optional[int] = None
    reject_reason: Optional[str] = None

    @field_serializer("invoice_unit_price")
    def serialize_invoice_unit_price(self, value: Decimal) -> str:
        literal = getattr(self, "invoice_unit_price_literal", None)
        return resolve_unit_price_literal(value, literal)

    @field_serializer("system_unit_price")
    def serialize_system_unit_price(self, value: Optional[Decimal]) -> Optional[str]:
        if value is None:
            return None
        literal = getattr(self, "system_unit_price_literal", None)
        return resolve_unit_price_literal(value, literal)


class FinanceInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    supplier_id: int
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    invoice_no: str
    invoice_code: Optional[str] = None
    invoice_date: Optional[date] = None
    total_amount: Decimal
    status: str
    reject_reason: Optional[str] = None
    remark: Optional[str] = None
    qr_raw_text: Optional[str] = None
    line_count: int = 0
    lines: List[FinanceInvoiceLineOut] = Field(default_factory=list)


class FinanceInvoiceCreate(BaseModel):
    supplier_id: int
    invoice_no: str = Field(max_length=64)
    invoice_code: Optional[str] = Field(None, max_length=64)
    invoice_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    qr_raw_text: Optional[str] = None
    remark: Optional[str] = None
    # 录入时整票拒收：有值则保存为已拒收，须重开票
    reject_reason: Optional[str] = Field(None, max_length=500)
    lines: List[FinanceInvoiceLineIn] = Field(min_length=1)

    @field_validator("invoice_no", mode="before")
    @classmethod
    def strip_invoice_no(cls, v):
        s = str(v or "").strip()
        if not s:
            raise ValueError("发票号码不能为空")
        return s

    @field_validator("reject_reason", mode="before")
    @classmethod
    def strip_reject_reason(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class FinanceInvoiceParseBody(BaseModel):
    qr_text: str = Field(min_length=1)


class FinanceInvoiceRejectBody(BaseModel):
    reject_reason: str = Field(min_length=1)

    @field_validator("reject_reason", mode="before")
    @classmethod
    def strip_reason(cls, v):
        s = str(v or "").strip()
        if not s:
            raise ValueError("拒收原因不能为空")
        return s


class FinanceInvoiceLineRejectBody(BaseModel):
    reject_reason: str = Field(min_length=1)


class FinanceInvoiceLineChangePriceBody(BaseModel):
    new_unit_price: Decimal = Field(ge=0)
    new_unit_price_literal: Optional[str] = Field(None, exclude=True)
    apply_to_price_list: bool = True
    remark: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def capture_price_literal(cls, data):
        if isinstance(data, dict) and isinstance(data.get("new_unit_price"), str):
            data["new_unit_price_literal"] = data["new_unit_price"].strip().replace(",", "")
        return data

    @field_validator("new_unit_price", mode="before")
    @classmethod
    def parse_new_unit_price(cls, v):
        return parse_unit_price_decimal(v)


class FinanceInvoiceLineQuickAddBody(BaseModel):
    price_type: Literal["含税", "不含税"] = "不含税"
    tax_rate: Optional[Decimal] = Field(None, ge=0)


class FinanceInvoiceRegisterPriceBody(BaseModel):
    """录入发票时，将未登记规格以当前发票单价写入供应商价格明细。"""

    supplier_id: int = Field(ge=1)
    spec: str = Field(max_length=200)
    unit_price: Decimal = Field(ge=0)
    unit_price_literal: Optional[str] = Field(None, exclude=True)
    material_code: Optional[str] = Field(None, max_length=64)
    material_name: Optional[str] = Field(None, max_length=200)
    unit: Optional[str] = Field(None, max_length=32)
    price_type: Literal["含税", "不含税"] = "不含税"
    tax_rate: Optional[Decimal] = Field(None, ge=0)

    @model_validator(mode="before")
    @classmethod
    def capture_price_literal(cls, data):
        if isinstance(data, dict) and isinstance(data.get("unit_price"), str):
            data["unit_price_literal"] = data["unit_price"].strip().replace(",", "")
        return data

    @field_validator("unit_price", mode="before")
    @classmethod
    def parse_unit_price(cls, v):
        return parse_unit_price_decimal(v)

    @field_validator("spec", mode="before")
    @classmethod
    def strip_spec(cls, v):
        s = str(v or "").strip()
        if not s:
            raise ValueError("规格不能为空")
        return s


class FinanceInvoiceRegisterPriceOut(BaseModel):
    id: int
    supplier_id: int
    material_code: str
    material_name: str
    spec: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Decimal
    price_type: str

    @field_serializer("unit_price")
    def ser_unit_price(self, value: Decimal) -> str:
        return resolve_unit_price_literal(value)


async def _serialize_invoice(row: HaoligoFinanceInvoice, *, with_lines: bool = False) -> FinanceInvoiceOut:
    supplier = await get_supplier_or_404(row.tenant_id, row.supplier_id)
    lines: list[FinanceInvoiceLineOut] = []
    line_qs = HaoligoFinanceInvoiceLine.filter(
        tenant_id=row.tenant_id, invoice_id=row.id, deleted_at__isnull=True
    )
    if with_lines:
        line_rows = await line_qs.order_by("line_no", "id")
        lines = [
            FinanceInvoiceLineOut(
                id=ln.id,
                uuid=ln.uuid,
                line_no=ln.line_no,
                material_code=ln.material_code,
                material_name=ln.material_name,
                spec=ln.spec,
                unit=ln.unit,
                quantity=ln.quantity,
                invoice_unit_price=ln.invoice_unit_price,
                invoice_unit_price_literal=ln.invoice_unit_price_literal,
                tax_amount=ln.tax_amount,
                system_unit_price=ln.system_unit_price,
                system_unit_price_literal=ln.system_unit_price_literal,
                price_diff_amount=ln.price_diff_amount,
                price_diff_ratio=ln.price_diff_ratio,
                line_status=ln.line_status,
                supplier_price_id=ln.supplier_price_id,
                reject_reason=ln.reject_reason,
            )
            for ln in line_rows
        ]
        line_count = len(lines)
    else:
        line_count = await line_qs.count()
    return FinanceInvoiceOut(
        id=row.id,
        uuid=row.uuid,
        supplier_id=row.supplier_id,
        supplier_code=supplier.supplier_code,
        supplier_name=supplier.supplier_name,
        invoice_no=row.invoice_no,
        invoice_code=row.invoice_code,
        invoice_date=row.invoice_date,
        total_amount=row.total_amount,
        status=row.status,
        reject_reason=row.reject_reason,
        remark=row.remark,
        qr_raw_text=row.qr_raw_text,
        line_count=line_count,
        lines=lines,
    )


async def _get_invoice_or_404(tenant_id: int, invoice_id: int) -> HaoligoFinanceInvoice:
    row = await tenant_alive(HaoligoFinanceInvoice, tenant_id).filter(id=invoice_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="发票不存在")
    return row


@router.post("/parse", summary="解析发票 QR/JSON")
async def parse_finance_invoice(
    body: FinanceInvoiceParseBody,
    _: Annotated[int, Depends(get_current_tenant)],
    __: Annotated[User, Depends(get_current_user)],
):
    parsed = parse_einvoice_qr_text(body.qr_text)
    return parsed


@router.post(
    "/register-price",
    response_model=FinanceInvoiceRegisterPriceOut,
    summary="录入时以当前发票单价登记到供应商价格明细",
)
async def register_price_from_invoice_entry(
    body: FinanceInvoiceRegisterPriceBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    spec = body.spec.strip()
    material_code = (body.material_code or "").strip() or spec
    material_name = (body.material_name or "").strip() or spec
    literal = body.unit_price_literal or resolve_unit_price_literal(body.unit_price)
    row = await quick_add_supplier_price(
        tenant_id=tenant_id,
        supplier_id=body.supplier_id,
        material_code=material_code,
        material_name=material_name,
        unit_price=body.unit_price,
        unit_price_literal=literal,
        price_type=body.price_type,
        spec=spec,
        unit=body.unit,
        tax_rate=body.tax_rate,
        operator=user,
    )
    return FinanceInvoiceRegisterPriceOut(
        id=row.id,
        supplier_id=row.supplier_id,
        material_code=row.material_code,
        material_name=row.material_name,
        spec=row.spec,
        unit=row.unit,
        unit_price=row.unit_price,
        price_type=row.price_type,
    )


@router.post("/parse-pdf", summary="解析数电发票 PDF（QR 发票头 + 可选 OCR 明细）")
async def parse_finance_invoice_pdf(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(..., description="数电发票 PDF"),
    exclude_invoice_id: Optional[int] = Query(None, description="编辑时排除自身，避免误报已登记"),
):
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF 文件为空")
    parsed = parse_einvoice_pdf_bytes(pdf_bytes)
    supplier_name = parsed.get("supplier_name")
    if isinstance(supplier_name, str) and supplier_name.strip():
        supplier = await resolve_supplier_by_name(tenant_id, supplier_name.strip())
        if supplier:
            parsed["supplier_id"] = supplier.id
            parsed["supplier_name"] = supplier.supplier_name
        else:
            parsed["supplier_match_hint"] = (
                f"未在台账找到供应商「{supplier_name.strip()}」，请手工选择或先维护供应商"
            )
    invoice_no = parsed.get("invoice_no")
    if isinstance(invoice_no, str) and invoice_no.strip():
        dup_qs = tenant_alive(HaoligoFinanceInvoice, tenant_id).filter(invoice_no=invoice_no.strip())
        if exclude_invoice_id is not None:
            dup_qs = dup_qs.exclude(id=exclude_invoice_id)
        parsed["already_registered"] = await dup_qs.exists()
    else:
        parsed["already_registered"] = False
    return parsed


@router.get("", response_model=List[FinanceInvoiceOut], summary="发票列表")
async def list_finance_invoices(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    qs = tenant_alive(HaoligoFinanceInvoice, tenant_id)
    if supplier_id is not None:
        qs = qs.filter(supplier_id=supplier_id)
    if status and status.strip():
        qs = qs.filter(status=status.strip())
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(Q(invoice_no__icontains=k) | Q(invoice_code__icontains=k))
    rows = await qs.order_by("-created_at").offset(skip).limit(limit)
    return [await _serialize_invoice(r, with_lines=False) for r in rows]


@router.get("/{invoice_id}", response_model=FinanceInvoiceOut, summary="发票详情")
async def get_finance_invoice(
    invoice_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await _get_invoice_or_404(tenant_id, invoice_id)
    return await _serialize_invoice(row, with_lines=True)


@router.post("", response_model=FinanceInvoiceOut, summary="录入发票")
async def create_finance_invoice(
    body: FinanceInvoiceCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _user: Annotated[User, Depends(get_current_user)],
):
    await get_supplier_or_404(tenant_id, body.supplier_id)
    structured = parse_structured_invoice_payload(
        {
            "invoice_no": body.invoice_no,
            "invoice_code": body.invoice_code,
            "invoice_date": body.invoice_date.isoformat() if body.invoice_date else None,
            "total_amount": body.total_amount,
            "lines": [
                {
                    **ln.model_dump(),
                    "invoice_unit_price_literal": ln.invoice_unit_price_literal
                    or resolve_unit_price_literal(ln.invoice_unit_price),
                }
                for ln in body.lines
            ],
        }
    )
    dup = await tenant_alive(HaoligoFinanceInvoice, tenant_id).filter(
        supplier_id=body.supplier_id, invoice_no=structured["invoice_no"]
    ).exists()
    if dup:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该供应商下发票号码已存在")

    reject_reason = body.reject_reason
    invoice_status = (
        FINANCE_INVOICE_STATUS_REJECTED if reject_reason else FINANCE_INVOICE_STATUS_PENDING
    )
    invoice = await HaoligoFinanceInvoice.create(
        tenant_id=tenant_id,
        supplier_id=body.supplier_id,
        invoice_no=structured["invoice_no"],
        invoice_code=structured.get("invoice_code"),
        invoice_date=structured.get("invoice_date") or body.invoice_date,
        total_amount=structured["total_amount"],
        qr_raw_text=(body.qr_raw_text or "").strip() or None,
        parsed_snapshot=invoice_snapshot_for_json(structured),
        status=invoice_status,
        reject_reason=reject_reason,
        remark=(body.remark or "").strip() or None,
    )
    for ln in structured["lines"]:
        await HaoligoFinanceInvoiceLine.create(
            tenant_id=tenant_id,
            invoice_id=invoice.id,
            line_no=ln["line_no"],
            material_code=ln["material_code"],
            material_name=ln["material_name"],
            spec=ln.get("spec"),
            unit=ln.get("unit"),
            quantity=ln["quantity"],
            invoice_unit_price=ln["invoice_unit_price"],
            invoice_unit_price_literal=ln.get("invoice_unit_price_literal"),
            tax_amount=ln.get("tax_amount"),
        )
    if invoice_status == FINANCE_INVOICE_STATUS_PENDING:
        await verify_invoice_lines(tenant_id, invoice)
    return await _serialize_invoice(invoice, with_lines=True)


@router.put("/{invoice_id}", response_model=FinanceInvoiceOut, summary="编辑已登记发票")
async def update_finance_invoice(
    invoice_id: int,
    body: FinanceInvoiceCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _user: Annotated[User, Depends(get_current_user)],
):
    invoice = await _get_invoice_or_404(tenant_id, invoice_id)
    if invoice.status != FINANCE_INVOICE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅已登记发票可编辑")
    await get_supplier_or_404(tenant_id, body.supplier_id)
    structured = parse_structured_invoice_payload(
        {
            "invoice_no": body.invoice_no,
            "invoice_code": body.invoice_code,
            "invoice_date": body.invoice_date.isoformat() if body.invoice_date else None,
            "total_amount": body.total_amount,
            "lines": [
                {
                    **ln.model_dump(),
                    "invoice_unit_price_literal": ln.invoice_unit_price_literal
                    or resolve_unit_price_literal(ln.invoice_unit_price),
                }
                for ln in body.lines
            ],
        }
    )
    dup = (
        await tenant_alive(HaoligoFinanceInvoice, tenant_id)
        .filter(supplier_id=body.supplier_id, invoice_no=structured["invoice_no"])
        .exclude(id=invoice.id)
        .exists()
    )
    if dup:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该供应商下发票号码已存在")

    reject_reason = body.reject_reason
    invoice_status = (
        FINANCE_INVOICE_STATUS_REJECTED if reject_reason else FINANCE_INVOICE_STATUS_PENDING
    )
    invoice.supplier_id = body.supplier_id
    invoice.invoice_no = structured["invoice_no"]
    invoice.invoice_code = structured.get("invoice_code")
    invoice.invoice_date = structured.get("invoice_date") or body.invoice_date
    invoice.total_amount = structured["total_amount"]
    invoice.qr_raw_text = (body.qr_raw_text or "").strip() or None
    invoice.parsed_snapshot = invoice_snapshot_for_json(structured)
    invoice.status = invoice_status
    invoice.reject_reason = reject_reason
    invoice.remark = (body.remark or "").strip() or None
    await invoice.save()

    await HaoligoFinanceInvoiceLine.filter(
        tenant_id=tenant_id, invoice_id=invoice.id, deleted_at__isnull=True
    ).update(deleted_at=timezone.now())
    for ln in structured["lines"]:
        await HaoligoFinanceInvoiceLine.create(
            tenant_id=tenant_id,
            invoice_id=invoice.id,
            line_no=ln["line_no"],
            material_code=ln["material_code"],
            material_name=ln["material_name"],
            spec=ln.get("spec"),
            unit=ln.get("unit"),
            quantity=ln["quantity"],
            invoice_unit_price=ln["invoice_unit_price"],
            invoice_unit_price_literal=ln.get("invoice_unit_price_literal"),
            tax_amount=ln.get("tax_amount"),
        )
    if invoice_status == FINANCE_INVOICE_STATUS_PENDING:
        await verify_invoice_lines(tenant_id, invoice)
    return await _serialize_invoice(invoice, with_lines=True)


@router.post("/{invoice_id}/verify", response_model=FinanceInvoiceOut, summary="单价核对")
async def verify_finance_invoice(
    invoice_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    invoice = await _get_invoice_or_404(tenant_id, invoice_id)
    await verify_invoice_lines(tenant_id, invoice)
    return await _serialize_invoice(invoice, with_lines=True)


@router.post("/{invoice_id}/reject", response_model=FinanceInvoiceOut, summary="拒收发票")
async def reject_finance_invoice(
    invoice_id: int,
    body: FinanceInvoiceRejectBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    invoice = await _get_invoice_or_404(tenant_id, invoice_id)
    if invoice.status != FINANCE_INVOICE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅已登记发票可拒收")
    invoice.status = FINANCE_INVOICE_STATUS_REJECTED
    invoice.reject_reason = body.reject_reason.strip()
    await invoice.save()
    return await _serialize_invoice(invoice, with_lines=True)


@router.post(
    "/{invoice_id}/lines/{line_id}/reject",
    response_model=FinanceInvoiceLineOut,
    summary="拒收发票明细行",
)
async def reject_finance_invoice_line(
    invoice_id: int,
    line_id: int,
    body: FinanceInvoiceLineRejectBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    invoice = await _get_invoice_or_404(tenant_id, invoice_id)
    if invoice.status != FINANCE_INVOICE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅已登记发票可操作")
    line = await HaoligoFinanceInvoiceLine.filter(
        tenant_id=tenant_id, invoice_id=invoice.id, id=line_id, deleted_at__isnull=True
    ).first()
    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="明细行不存在")
    line.line_status = FINANCE_INVOICE_LINE_STATUS_REJECTED
    line.reject_reason = body.reject_reason.strip()
    await line.save()
    return FinanceInvoiceLineOut(
        id=line.id,
        uuid=line.uuid,
        line_no=line.line_no,
        material_code=line.material_code,
        material_name=line.material_name,
        spec=line.spec,
        unit=line.unit,
        quantity=line.quantity,
        invoice_unit_price=line.invoice_unit_price,
        invoice_unit_price_literal=line.invoice_unit_price_literal,
        tax_amount=line.tax_amount,
        system_unit_price=line.system_unit_price,
        system_unit_price_literal=line.system_unit_price_literal,
        price_diff_amount=line.price_diff_amount,
        price_diff_ratio=line.price_diff_ratio,
        line_status=line.line_status,
        supplier_price_id=line.supplier_price_id,
        reject_reason=line.reject_reason,
    )


@router.post(
    "/{invoice_id}/lines/{line_id}/change-price",
    response_model=FinanceInvoiceOut,
    summary="改价并更新单价清单",
)
async def change_price_on_invoice_line(
    invoice_id: int,
    line_id: int,
    body: FinanceInvoiceLineChangePriceBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await _get_invoice_or_404(tenant_id, invoice_id)
    if invoice.status != FINANCE_INVOICE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅已登记发票可操作")
    line = await HaoligoFinanceInvoiceLine.filter(
        tenant_id=tenant_id, invoice_id=invoice.id, id=line_id, deleted_at__isnull=True
    ).first()
    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="明细行不存在")

    new_literal = body.new_unit_price_literal or resolve_unit_price_literal(body.new_unit_price)

    if body.apply_to_price_list:
        supplier = await get_supplier_or_404(tenant_id, invoice.supplier_id)
        if line.supplier_price_id:
            from apps.haoligo.models.finance_supplier import HaoligoFinanceSupplierPrice

            price_row = await HaoligoFinanceSupplierPrice.filter(
                tenant_id=tenant_id, id=line.supplier_price_id, deleted_at__isnull=True
            ).first()
            if price_row:
                await change_supplier_price(
                    tenant_id=tenant_id,
                    price_row=price_row,
                    new_unit_price=body.new_unit_price,
                    new_unit_price_literal=new_literal,
                    operator=user,
                    change_source=FINANCE_PRICE_CHANGE_SOURCE_INVOICE_VERIFY,
                    remark=body.remark,
                )
            else:
                await create_supplier_price_row(
                    tenant_id=tenant_id,
                    supplier=supplier,
                    material_code=line.material_code,
                    material_name=line.material_name,
                    unit_price=body.new_unit_price,
                    unit_price_literal=new_literal,
                    price_type="含税",
                    spec=line.spec,
                    unit=line.unit,
                    change_source=FINANCE_PRICE_CHANGE_SOURCE_INVOICE_VERIFY,
                    operator=user,
                    remark=body.remark,
                )
        else:
            await create_supplier_price_row(
                tenant_id=tenant_id,
                supplier=supplier,
                material_code=line.material_code,
                material_name=line.material_name,
                unit_price=body.new_unit_price,
                unit_price_literal=new_literal,
                price_type="含税",
                spec=line.spec,
                unit=line.unit,
                change_source=FINANCE_PRICE_CHANGE_SOURCE_INVOICE_VERIFY,
                operator=user,
                remark=body.remark,
            )

    line.invoice_unit_price = body.new_unit_price
    line.invoice_unit_price_literal = new_literal
    await line.save()
    await verify_invoice_lines(tenant_id, invoice)
    return await _serialize_invoice(invoice, with_lines=True)


@router.post(
    "/{invoice_id}/lines/{line_id}/quick-add-price",
    response_model=FinanceInvoiceOut,
    summary="快速添加物料单价",
)
async def quick_add_price_on_invoice_line(
    invoice_id: int,
    line_id: int,
    body: FinanceInvoiceLineQuickAddBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    invoice = await _get_invoice_or_404(tenant_id, invoice_id)
    line = await HaoligoFinanceInvoiceLine.filter(
        tenant_id=tenant_id, invoice_id=invoice.id, id=line_id, deleted_at__isnull=True
    ).first()
    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="明细行不存在")
    await quick_add_supplier_price(
        tenant_id=tenant_id,
        supplier_id=invoice.supplier_id,
        material_code=line.material_code,
        material_name=line.material_name,
        unit_price=line.invoice_unit_price,
        unit_price_literal=line.invoice_unit_price_literal
        or resolve_unit_price_literal(line.invoice_unit_price),
        price_type=body.price_type,
        spec=line.spec,
        unit=line.unit,
        tax_rate=body.tax_rate,
        operator=user,
    )
    await verify_invoice_lines(tenant_id, invoice)
    return await _serialize_invoice(invoice, with_lines=True)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除发票")
async def delete_finance_invoice(
    invoice_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    invoice = await _get_invoice_or_404(tenant_id, invoice_id)
    if invoice.status != FINANCE_INVOICE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅已登记发票可删除")
    invoice.deleted_at = timezone.now()
    await invoice.save()
