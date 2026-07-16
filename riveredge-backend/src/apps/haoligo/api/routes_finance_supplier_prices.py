"""好力 GO — 供应商价格明细（跨供应商单价清单）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.finance_supplier_price import (
    FINANCE_PRICE_CHANGE_SOURCE_MANUAL,
    FINANCE_PRICE_TYPE_TAX_EXCLUSIVE,
    FINANCE_PRICE_TYPES,
)
from apps.haoligo.models.finance_supplier import HaoligoFinanceSupplier, HaoligoFinanceSupplierPrice
from apps.haoligo.services.finance_supplier_price import (
    change_supplier_price,
    create_supplier_price_row,
    get_supplier_or_404,
)
from apps.haoligo.services.finance_supplier_price_import import (
    FinanceSupplierPriceImportRowInput,
    import_finance_supplier_prices,
)
from apps.haoligo.utils.finance_decimal import parse_unit_price_decimal, resolve_unit_price_literal
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/finance",
    tags=["App - HaoliGO - 财务管理"],
    dependencies=[Depends(require_haoligo_module_access("finance-supplier-prices"))],
)

PriceTypeLiteral = Literal["含税", "不含税"]


class FinanceSupplierPriceLedgerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    supplier_id: int
    supplier_code: str
    supplier_name: str
    material_code: str
    material_name: str
    spec: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Decimal
    unit_price_literal: Optional[str] = Field(None, exclude=True)
    price_type: str
    tax_rate: Optional[Decimal] = None
    is_active: bool
    remark: Optional[str] = None

    @field_serializer("unit_price")
    def serialize_unit_price(self, value: Decimal) -> str:
        literal = getattr(self, "unit_price_literal", None)
        return resolve_unit_price_literal(value, literal)


class FinanceSupplierPriceLedgerCreate(BaseModel):
    supplier_id: int
    spec: str = Field(max_length=200)
    unit_price: Decimal = Field(ge=0)
    unit_price_literal: Optional[str] = Field(None, exclude=True)
    price_type: PriceTypeLiteral = FINANCE_PRICE_TYPE_TAX_EXCLUSIVE
    unit: Optional[str] = Field(None, max_length=32)
    tax_rate: Optional[Decimal] = Field(None, ge=0)
    remark: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def capture_price_literal(cls, data):
        if isinstance(data, dict) and isinstance(data.get("unit_price"), str):
            data["unit_price_literal"] = data["unit_price"].strip().replace(",", "")
        return data

    @field_validator("spec", mode="before")
    @classmethod
    def strip_spec(cls, v):
        s = str(v or "").strip()
        if not s:
            raise ValueError("规格不能为空")
        return s

    @field_validator("unit_price", mode="before")
    @classmethod
    def parse_unit_price(cls, v):
        return parse_unit_price_decimal(v)


class FinanceSupplierPriceLedgerUpdate(BaseModel):
    spec: Optional[str] = Field(None, max_length=200)
    unit_price: Optional[Decimal] = Field(None, ge=0)
    unit_price_literal: Optional[str] = Field(None, exclude=True)
    price_type: Optional[PriceTypeLiteral] = None
    unit: Optional[str] = Field(None, max_length=32)
    tax_rate: Optional[Decimal] = Field(None, ge=0)
    remark: Optional[str] = None
    change_source: Optional[str] = Field(None, max_length=32)

    @model_validator(mode="before")
    @classmethod
    def capture_price_literal(cls, data):
        if isinstance(data, dict) and isinstance(data.get("unit_price"), str):
            data["unit_price_literal"] = data["unit_price"].strip().replace(",", "")
        return data

    @field_validator("unit_price", mode="before")
    @classmethod
    def parse_unit_price(cls, v):
        if v is None or v == "":
            return None
        return parse_unit_price_decimal(v)


class FinanceSupplierPriceImportRow(BaseModel):
    supplier_name: str = Field(max_length=200)
    spec: str = Field(max_length=200)
    unit_price: Decimal = Field(ge=0)
    unit_price_literal: Optional[str] = Field(None, exclude=True)
    remark: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def capture_price_literal(cls, data):
        if isinstance(data, dict) and isinstance(data.get("unit_price"), str):
            data["unit_price_literal"] = data["unit_price"].strip().replace(",", "")
        return data

    @field_validator("supplier_name", "spec", mode="before")
    @classmethod
    def strip_required(cls, v, info):
        s = str(v or "").strip()
        if not s:
            raise ValueError(f"{info.field_name} 不能为空")
        return s

    @field_validator("unit_price", mode="before")
    @classmethod
    def parse_unit_price(cls, v):
        return parse_unit_price_decimal(v)


class FinanceSupplierPriceImportBody(BaseModel):
    rows: list[FinanceSupplierPriceImportRow] = Field(min_length=1)


class FinanceSupplierPriceImportResult(BaseModel):
    created_count: int
    updated_count: int
    suppliers_created_count: int
    failed_count: int
    errors: list[str]


class FinanceBatchDeleteBody(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)


class FinanceBatchDeleteResult(BaseModel):
    deleted_count: int


async def _serialize_ledger_row(
    price_row: HaoligoFinanceSupplierPrice,
    supplier: HaoligoFinanceSupplier | None = None,
) -> FinanceSupplierPriceLedgerOut:
    if supplier is None:
        supplier = await HaoligoFinanceSupplier.filter(
            tenant_id=price_row.tenant_id, id=price_row.supplier_id, deleted_at__isnull=True
        ).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="供应商数据异常")
    return FinanceSupplierPriceLedgerOut(
        id=price_row.id,
        uuid=price_row.uuid,
        supplier_id=price_row.supplier_id,
        supplier_code=supplier.supplier_code,
        supplier_name=supplier.supplier_name,
        material_code=price_row.material_code,
        material_name=price_row.material_name,
        spec=price_row.spec,
        unit=price_row.unit,
        unit_price=price_row.unit_price,
        unit_price_literal=price_row.unit_price_literal,
        price_type=price_row.price_type,
        tax_rate=price_row.tax_rate,
        is_active=price_row.is_active,
        remark=price_row.remark,
    )


@router.get("/supplier-prices", response_model=List[FinanceSupplierPriceLedgerOut], summary="供应商价格明细列表")
async def list_finance_supplier_price_ledger(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    keyword: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    include_history: bool = Query(False, description="是否包含历史价格行"),
):
    qs = tenant_alive(HaoligoFinanceSupplierPrice, tenant_id)
    if not include_history:
        qs = qs.filter(is_active=True)
    if supplier_id is not None:
        qs = qs.filter(supplier_id=supplier_id)
    if keyword and keyword.strip():
        k = keyword.strip()
        supplier_ids = await tenant_alive(HaoligoFinanceSupplier, tenant_id).filter(
            Q(supplier_code__icontains=k) | Q(supplier_name__icontains=k)
        ).values_list("id", flat=True)
        qs = qs.filter(
            Q(material_code__icontains=k)
            | Q(material_name__icontains=k)
            | Q(spec__icontains=k)
            | Q(supplier_id__in=list(supplier_ids))
        )
    rows = await qs.order_by("supplier_id", "material_code", "-is_active", "-id")
    supplier_map: dict[int, HaoligoFinanceSupplier] = {}
    if rows:
        supplier_ids = {r.supplier_id for r in rows}
        suppliers = await tenant_alive(HaoligoFinanceSupplier, tenant_id).filter(id__in=list(supplier_ids))
        supplier_map = {s.id: s for s in suppliers}
    return [
        await _serialize_ledger_row(row, supplier_map.get(row.supplier_id))
        for row in rows
        if row.supplier_id in supplier_map
    ]


@router.post("/supplier-prices", response_model=FinanceSupplierPriceLedgerOut, summary="新建供应商价格明细")
async def create_finance_supplier_price_ledger(
    body: FinanceSupplierPriceLedgerCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    if body.price_type not in FINANCE_PRICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="价类无效")
    supplier = await get_supplier_or_404(tenant_id, body.supplier_id)
    spec = body.spec.strip()
    row = await create_supplier_price_row(
        tenant_id=tenant_id,
        supplier=supplier,
        material_code=spec,
        material_name=spec,
        unit_price=body.unit_price,
        unit_price_literal=body.unit_price_literal,
        price_type=body.price_type,
        spec=spec,
        unit=body.unit,
        tax_rate=body.tax_rate,
        remark=body.remark,
        operator=user,
        close_existing=True,
    )
    return await _serialize_ledger_row(row, supplier)


@router.patch("/supplier-prices/{price_id}", response_model=FinanceSupplierPriceLedgerOut, summary="更新供应商价格明细")
async def update_finance_supplier_price_ledger(
    price_id: int,
    body: FinanceSupplierPriceLedgerUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoFinanceSupplierPrice, tenant_id).filter(id=price_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="价格明细不存在")
    supplier = await get_supplier_or_404(tenant_id, row.supplier_id)
    data = body.model_dump(exclude_unset=True)

    if "unit_price" in data and data["unit_price"] is not None:
        new_literal = body.unit_price_literal or resolve_unit_price_literal(data["unit_price"])
        old_literal = row.unit_price_literal or resolve_unit_price_literal(row.unit_price)
        if data["unit_price"] != row.unit_price or new_literal != old_literal:
            change_source = (body.change_source or "").strip() or FINANCE_PRICE_CHANGE_SOURCE_MANUAL
            row = await change_supplier_price(
                tenant_id=tenant_id,
                price_row=row,
                new_unit_price=data["unit_price"],
                new_unit_price_literal=new_literal,
                operator=user,
                change_source=change_source,
                remark=data.get("remark", row.remark),
            )

    if "spec" in data and data["spec"] is not None:
        spec = data["spec"].strip()
        row.spec = spec
        row.material_code = spec
        row.material_name = spec
    if "price_type" in data and data["price_type"] is not None:
        if data["price_type"] not in FINANCE_PRICE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="价类无效")
        row.price_type = data["price_type"]
    if "unit" in data:
        row.unit = (data["unit"] or "").strip() or None if isinstance(data["unit"], str) else data["unit"]
    if "tax_rate" in data:
        row.tax_rate = data["tax_rate"]
    if "remark" in data:
        row.remark = (data["remark"] or "").strip() or None if isinstance(data["remark"], str) else data["remark"]
    await row.save()

    return await _serialize_ledger_row(row, supplier)


@router.delete("/supplier-prices/{price_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除供应商价格明细")
async def delete_finance_supplier_price_ledger(
    price_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoFinanceSupplierPrice, tenant_id).filter(id=price_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="价格明细不存在")
    row.is_active = False
    row.deleted_at = timezone.now()
    await row.save()


@router.post(
    "/supplier-prices/batch-delete",
    response_model=FinanceBatchDeleteResult,
    summary="批量删除供应商价格明细",
)
async def batch_delete_finance_supplier_price_ledger(
    body: FinanceBatchDeleteBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    unique_ids = list(dict.fromkeys(body.ids))
    now = timezone.now()
    deleted_count = await tenant_alive(HaoligoFinanceSupplierPrice, tenant_id).filter(
        id__in=unique_ids
    ).update(is_active=False, deleted_at=now)
    return FinanceBatchDeleteResult(deleted_count=deleted_count)


@router.post(
    "/supplier-prices/import",
    response_model=FinanceSupplierPriceImportResult,
    summary="批量导入供应商价格明细",
)
async def import_finance_supplier_price_ledger(
    body: FinanceSupplierPriceImportBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    rows = [
        FinanceSupplierPriceImportRowInput(
            supplier_name=row.supplier_name.strip(),
            spec=row.spec.strip(),
            unit_price=row.unit_price,
            unit_price_literal=row.unit_price_literal
            or resolve_unit_price_literal(row.unit_price),
            remark=(row.remark or "").strip() or None,
        )
        for row in body.rows
    ]
    outcome = await import_finance_supplier_prices(tenant_id, rows, operator=user)
    return FinanceSupplierPriceImportResult(
        created_count=outcome.created_count,
        updated_count=outcome.updated_count,
        suppliers_created_count=outcome.suppliers_created_count,
        failed_count=outcome.failed_count,
        errors=outcome.errors,
    )
