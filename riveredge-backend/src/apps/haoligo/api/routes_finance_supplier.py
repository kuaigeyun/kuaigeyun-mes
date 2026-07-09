"""好力 GO — 财务材料供应商与单价清单 API。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.finance_supplier_price import (
    FINANCE_PRICE_TYPE_TAX_INCLUSIVE,
    FINANCE_PRICE_TYPES,
)
from apps.haoligo.models.finance_supplier import (
    HaoligoFinancePriceChangeLog,
    HaoligoFinanceSupplier,
    HaoligoFinanceSupplierPrice,
)
from apps.haoligo.services.finance_supplier_import import (
    FinanceSupplierImportRowInput,
    import_finance_suppliers,
)
from apps.haoligo.services.finance_supplier_price import (
    change_supplier_price,
    create_supplier_price_row,
    get_supplier_or_404,
    quick_add_supplier_price,
)
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/finance",
    tags=["App · HaoliGO · 财务管理"],
    dependencies=[Depends(require_haoligo_module_access("finance-suppliers"))],
)

PriceTypeLiteral = Literal["含税", "不含税"]


class FinanceSupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    supplier_code: str
    supplier_name: str
    tax_no: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    payment_terms_days: int
    settlement_method: Optional[str] = None
    is_active: bool
    remark: Optional[str] = None


class FinanceSupplierCreate(BaseModel):
    supplier_code: str = Field(max_length=64)
    supplier_name: str = Field(max_length=200)
    tax_no: Optional[str] = Field(None, max_length=64)
    contact_name: Optional[str] = Field(None, max_length=100)
    contact_phone: Optional[str] = Field(None, max_length=64)
    payment_terms_days: int = Field(default=0, ge=0)
    settlement_method: Optional[str] = Field(None, max_length=64)
    is_active: bool = True
    remark: Optional[str] = None

    @field_validator("supplier_code", "supplier_name", mode="before")
    @classmethod
    def strip_required(cls, v, info):
        s = str(v or "").strip()
        if not s:
            raise ValueError(f"{info.field_name} 不能为空")
        return s


class FinanceSupplierUpdate(BaseModel):
    supplier_code: Optional[str] = Field(None, max_length=64)
    supplier_name: Optional[str] = Field(None, max_length=200)
    tax_no: Optional[str] = Field(None, max_length=64)
    contact_name: Optional[str] = Field(None, max_length=100)
    contact_phone: Optional[str] = Field(None, max_length=64)
    payment_terms_days: Optional[int] = Field(None, ge=0)
    settlement_method: Optional[str] = Field(None, max_length=64)
    is_active: Optional[bool] = None
    remark: Optional[str] = None


class FinanceSupplierImportRow(FinanceSupplierCreate):
    pass


class FinanceSupplierImportBody(BaseModel):
    rows: list[FinanceSupplierImportRow] = Field(min_length=1)


class FinanceSupplierImportResult(BaseModel):
    created_count: int
    failed_count: int
    errors: list[str]


class FinanceBatchDeleteBody(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)


class FinanceBatchDeleteResult(BaseModel):
    deleted_count: int


class FinanceSupplierPriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    supplier_id: int
    material_code: str
    material_name: str
    spec: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Decimal
    price_type: str
    tax_rate: Optional[Decimal] = None
    material_id: Optional[int] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: bool
    remark: Optional[str] = None


class FinanceSupplierPriceCreate(BaseModel):
    material_code: str = Field(max_length=64)
    material_name: str = Field(max_length=200)
    spec: Optional[str] = Field(None, max_length=200)
    unit: Optional[str] = Field(None, max_length=32)
    unit_price: Decimal = Field(ge=0)
    price_type: PriceTypeLiteral = FINANCE_PRICE_TYPE_TAX_INCLUSIVE
    tax_rate: Optional[Decimal] = Field(None, ge=0)
    material_id: Optional[int] = None
    remark: Optional[str] = None

    @field_validator("material_code", "material_name", mode="before")
    @classmethod
    def strip_required(cls, v, info):
        s = str(v or "").strip()
        if not s:
            raise ValueError(f"{info.field_name} 不能为空")
        return s


class FinanceSupplierPriceChangeBody(BaseModel):
    unit_price: Decimal = Field(ge=0)
    remark: Optional[str] = None


class FinancePriceChangeLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    supplier_id: int
    supplier_price_id: Optional[int] = None
    previous_price_id: Optional[int] = None
    material_code: str
    material_name: str
    old_unit_price: Optional[Decimal] = None
    new_unit_price: Decimal
    change_source: str
    operator_user_name: Optional[str] = None
    remark: Optional[str] = None
    created_at: str


def _serialize_supplier(row: HaoligoFinanceSupplier) -> FinanceSupplierOut:
    return FinanceSupplierOut.model_validate(row)


def _serialize_price(row: HaoligoFinanceSupplierPrice) -> FinanceSupplierPriceOut:
    return FinanceSupplierPriceOut(
        id=row.id,
        uuid=row.uuid,
        supplier_id=row.supplier_id,
        material_code=row.material_code,
        material_name=row.material_name,
        spec=row.spec,
        unit=row.unit,
        unit_price=row.unit_price,
        price_type=row.price_type,
        tax_rate=row.tax_rate,
        material_id=row.material_id,
        effective_from=row.effective_from,
        effective_to=row.effective_to,
        is_active=row.is_active,
        remark=row.remark,
    )


def _serialize_change_log(row: HaoligoFinancePriceChangeLog) -> FinancePriceChangeLogOut:
    return FinancePriceChangeLogOut(
        id=row.id,
        uuid=row.uuid,
        supplier_id=row.supplier_id,
        supplier_price_id=row.supplier_price_id,
        previous_price_id=row.previous_price_id,
        material_code=row.material_code,
        material_name=row.material_name,
        old_unit_price=row.old_unit_price,
        new_unit_price=row.new_unit_price,
        change_source=row.change_source,
        operator_user_name=row.operator_user_name,
        remark=row.remark,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


@router.get("/suppliers", response_model=List[FinanceSupplierOut], summary="材料供应商列表")
async def list_finance_suppliers(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    qs = tenant_alive(HaoligoFinanceSupplier, tenant_id)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(supplier_code__icontains=k)
            | Q(supplier_name__icontains=k)
            | Q(tax_no__icontains=k)
            | Q(contact_name__icontains=k)
        )
    rows = await qs.order_by("supplier_code")
    return [_serialize_supplier(r) for r in rows]


@router.get("/suppliers/{row_id}", response_model=FinanceSupplierOut, summary="材料供应商详情")
async def get_finance_supplier(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await get_supplier_or_404(tenant_id, row_id)
    return _serialize_supplier(row)


@router.post("/suppliers", response_model=FinanceSupplierOut, summary="新建材料供应商")
async def create_finance_supplier(
    body: FinanceSupplierCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    code = body.supplier_code.strip()
    exists = await tenant_alive(HaoligoFinanceSupplier, tenant_id).filter(supplier_code=code).exists()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="供应商代号已存在")
    row = await HaoligoFinanceSupplier.create(
        tenant_id=tenant_id,
        supplier_code=code,
        supplier_name=body.supplier_name.strip(),
        tax_no=(body.tax_no or "").strip() or None,
        contact_name=(body.contact_name or "").strip() or None,
        contact_phone=(body.contact_phone or "").strip() or None,
        payment_terms_days=body.payment_terms_days,
        settlement_method=(body.settlement_method or "").strip() or None,
        is_active=body.is_active,
        remark=(body.remark or "").strip() or None,
    )
    return _serialize_supplier(row)


@router.post(
    "/suppliers/import",
    response_model=FinanceSupplierImportResult,
    summary="批量导入材料供应商",
)
async def import_finance_suppliers_route(
    body: FinanceSupplierImportBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = [
        FinanceSupplierImportRowInput(
            supplier_code=row.supplier_code.strip(),
            supplier_name=row.supplier_name.strip(),
            tax_no=(row.tax_no or "").strip() or None,
            contact_name=(row.contact_name or "").strip() or None,
            contact_phone=(row.contact_phone or "").strip() or None,
            payment_terms_days=row.payment_terms_days,
            settlement_method=(row.settlement_method or "").strip() or None,
            is_active=row.is_active,
            remark=(row.remark or "").strip() or None,
        )
        for row in body.rows
    ]
    outcome = await import_finance_suppliers(tenant_id, rows)
    return FinanceSupplierImportResult(
        created_count=outcome.created_count,
        failed_count=outcome.failed_count,
        errors=outcome.errors,
    )


@router.post(
    "/suppliers/batch-delete",
    response_model=FinanceBatchDeleteResult,
    summary="批量删除材料供应商",
)
async def batch_delete_finance_suppliers(
    body: FinanceBatchDeleteBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    unique_ids = list(dict.fromkeys(body.ids))
    now = timezone.now()
    deleted_count = await tenant_alive(HaoligoFinanceSupplier, tenant_id).filter(
        id__in=unique_ids
    ).update(deleted_at=now)
    return FinanceBatchDeleteResult(deleted_count=deleted_count)


@router.patch("/suppliers/{row_id}", response_model=FinanceSupplierOut, summary="更新材料供应商")
async def update_finance_supplier(
    row_id: int,
    body: FinanceSupplierUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await get_supplier_or_404(tenant_id, row_id)
    data = body.model_dump(exclude_unset=True)
    if "supplier_code" in data and data["supplier_code"] is not None:
        code = data["supplier_code"].strip()
        dup = (
            await tenant_alive(HaoligoFinanceSupplier, tenant_id)
            .filter(supplier_code=code)
            .exclude(id=row_id)
            .exists()
        )
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="供应商代号已存在")
        row.supplier_code = code
    if "supplier_name" in data and data["supplier_name"] is not None:
        row.supplier_name = data["supplier_name"].strip()
    for field in ("tax_no", "contact_name", "contact_phone", "settlement_method", "remark"):
        if field in data:
            val = data[field]
            setattr(row, field, (val or "").strip() or None if isinstance(val, str) else val)
    if "payment_terms_days" in data and data["payment_terms_days"] is not None:
        row.payment_terms_days = data["payment_terms_days"]
    if "is_active" in data and data["is_active"] is not None:
        row.is_active = data["is_active"]
    await row.save()
    return _serialize_supplier(row)


@router.delete("/suppliers/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除材料供应商")
async def delete_finance_supplier(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await get_supplier_or_404(tenant_id, row_id)
    row.deleted_at = timezone.now()
    await row.save()


@router.get(
    "/suppliers/{supplier_id}/prices",
    response_model=List[FinanceSupplierPriceOut],
    summary="供应商单价清单",
)
async def list_finance_supplier_prices(
    supplier_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    keyword: Optional[str] = Query(None),
    include_history: bool = Query(False, description="是否包含历史价格行"),
):
    await get_supplier_or_404(tenant_id, supplier_id)
    qs = tenant_alive(HaoligoFinanceSupplierPrice, tenant_id).filter(supplier_id=supplier_id)
    if not include_history:
        qs = qs.filter(is_active=True)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(material_code__icontains=k) | Q(material_name__icontains=k) | Q(spec__icontains=k)
        )
    rows = await qs.order_by("-is_active", "material_code", "-effective_from", "-id")
    return [_serialize_price(r) for r in rows]


@router.post(
    "/suppliers/{supplier_id}/prices",
    response_model=FinanceSupplierPriceOut,
    summary="新增供应商单价",
)
async def create_finance_supplier_price(
    supplier_id: int,
    body: FinanceSupplierPriceCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    supplier = await get_supplier_or_404(tenant_id, supplier_id)
    if body.price_type not in FINANCE_PRICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="价类无效")
    row = await create_supplier_price_row(
        tenant_id=tenant_id,
        supplier=supplier,
        material_code=body.material_code,
        material_name=body.material_name,
        unit_price=body.unit_price,
        price_type=body.price_type,
        spec=body.spec,
        unit=body.unit,
        tax_rate=body.tax_rate,
        material_id=body.material_id,
        remark=body.remark,
        operator=user,
        close_existing=True,
    )
    return _serialize_price(row)


@router.post(
    "/suppliers/{supplier_id}/prices/quick-add",
    response_model=FinanceSupplierPriceOut,
    summary="快速添加供应商物料单价",
)
async def quick_add_finance_supplier_price(
    supplier_id: int,
    body: FinanceSupplierPriceCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    if body.price_type not in FINANCE_PRICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="价类无效")
    row = await quick_add_supplier_price(
        tenant_id=tenant_id,
        supplier_id=supplier_id,
        material_code=body.material_code,
        material_name=body.material_name,
        unit_price=body.unit_price,
        price_type=body.price_type,
        spec=body.spec,
        unit=body.unit,
        tax_rate=body.tax_rate,
        material_id=body.material_id,
        operator=user,
    )
    return _serialize_price(row)


@router.post(
    "/supplier-prices/{price_id}/change-price",
    response_model=FinanceSupplierPriceOut,
    summary="改价（关旧开新）",
)
async def change_finance_supplier_price(
    price_id: int,
    body: FinanceSupplierPriceChangeBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoFinanceSupplierPrice, tenant_id).filter(id=price_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="单价记录不存在")
    new_row = await change_supplier_price(
        tenant_id=tenant_id,
        price_row=row,
        new_unit_price=body.unit_price,
        operator=user,
        remark=body.remark,
    )
    return _serialize_price(new_row)


@router.get(
    "/suppliers/{supplier_id}/price-change-logs",
    response_model=List[FinancePriceChangeLogOut],
    summary="供应商单价变更历史",
)
async def list_finance_price_change_logs(
    supplier_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    material_code: Optional[str] = Query(None),
):
    await get_supplier_or_404(tenant_id, supplier_id)
    qs = tenant_alive(HaoligoFinancePriceChangeLog, tenant_id).filter(supplier_id=supplier_id)
    if material_code and material_code.strip():
        qs = qs.filter(material_code=material_code.strip())
    rows = await qs.order_by("-created_at")
    return [_serialize_change_log(r) for r in rows]
