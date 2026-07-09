"""好力 GO 财务 — 材料供应商单价业务（关旧开新 + 留痕）。"""

from __future__ import annotations

import hashlib
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from tortoise import timezone

from apps.haoligo.constants.finance_supplier_price import (
    FINANCE_PRICE_CHANGE_SOURCE_MANUAL,
    FINANCE_PRICE_CHANGE_SOURCE_QUICK_ADD,
    FINANCE_PRICE_TYPES,
)
from apps.haoligo.models.finance_supplier import (
    HaoligoFinancePriceChangeLog,
    HaoligoFinanceSupplier,
    HaoligoFinanceSupplierPrice,
)
from apps.haoligo.utils.finance_decimal import resolve_unit_price_literal
from apps.haoligo.utils.finance_spec_key import normalize_finance_material_spec_key
from infra.models.user import User


def _today() -> date:
    return timezone.now().date()


def _validate_price_type(price_type: str) -> str:
    pt = (price_type or "").strip()
    if pt not in FINANCE_PRICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="价类无效，须为含税或不含税")
    return pt


async def get_supplier_or_404(tenant_id: int, supplier_id: int) -> HaoligoFinanceSupplier:
    row = await HaoligoFinanceSupplier.filter(
        tenant_id=tenant_id, id=supplier_id, deleted_at__isnull=True
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="供应商不存在")
    return row


async def resolve_supplier_by_name(tenant_id: int, supplier_name: str) -> HaoligoFinanceSupplier | None:
    name = (supplier_name or "").strip()
    if not name:
        return None
    exact = await HaoligoFinanceSupplier.filter(
        tenant_id=tenant_id, supplier_name=name, deleted_at__isnull=True
    ).first()
    if exact:
        return exact
    matches = await HaoligoFinanceSupplier.filter(
        tenant_id=tenant_id, supplier_name__icontains=name, deleted_at__isnull=True
    ).all()
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        for row in matches:
            if row.supplier_name.strip() == name:
                return row
        return None
    all_active = await HaoligoFinanceSupplier.filter(
        tenant_id=tenant_id, deleted_at__isnull=True
    ).all()
    reverse = [
        row
        for row in all_active
        if row.supplier_name and row.supplier_name.strip() and row.supplier_name.strip() in name
    ]
    if len(reverse) == 1:
        return reverse[0]
    if len(reverse) > 1:
        reverse.sort(key=lambda row: len(row.supplier_name or ""), reverse=True)
        return reverse[0]
    return None


def _base_supplier_code_from_name(supplier_name: str) -> str:
    digest = hashlib.sha256(supplier_name.strip().encode("utf-8")).hexdigest()[:10].upper()
    return f"GYS{digest}"


async def _allocate_supplier_code(tenant_id: int, supplier_name: str) -> str:
    base = _base_supplier_code_from_name(supplier_name)
    qs = HaoligoFinanceSupplier.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if not await qs.filter(supplier_code=base).exists():
        return base
    for i in range(2, 10000):
        suffix = f"-{i}"
        head = base[: 64 - len(suffix)]
        candidate = f"{head}{suffix}"
        if not await qs.filter(supplier_code=candidate).exists():
            return candidate
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"无法为供应商「{supplier_name}」生成唯一代号",
    )


async def get_or_create_supplier_by_name(
    tenant_id: int,
    supplier_name: str,
) -> tuple[HaoligoFinanceSupplier, bool]:
    """按名称解析供应商；不存在则自动创建（代号 GYS+名称哈希）。"""
    name = (supplier_name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="供应商名称不能为空")
    existing = await resolve_supplier_by_name(tenant_id, name)
    if existing:
        return existing, False
    code = await _allocate_supplier_code(tenant_id, name)
    row = await HaoligoFinanceSupplier.create(
        tenant_id=tenant_id,
        supplier_code=code,
        supplier_name=name,
        payment_terms_days=0,
        is_active=True,
    )
    return row, True


async def find_active_price(
    tenant_id: int,
    supplier_id: int,
    material_code: str,
) -> HaoligoFinanceSupplierPrice | None:
    code = (material_code or "").strip()
    if not code:
        return None
    today = _today()
    base_qs = HaoligoFinanceSupplierPrice.filter(
        tenant_id=tenant_id,
        supplier_id=supplier_id,
        is_active=True,
        deleted_at__isnull=True,
    )

    async def _pick(qs):
        return (
            await qs.filter(material_code=code).filter(effective_to__isnull=True).first()
            or await qs.filter(material_code=code, effective_to__gte=today)
            .order_by("-effective_from", "-id")
            .first()
        )

    hit = await _pick(base_qs)
    if hit:
        return hit

    hit = (
        await base_qs.filter(spec=code).filter(effective_to__isnull=True).first()
        or await base_qs.filter(spec=code, effective_to__gte=today)
        .order_by("-effective_from", "-id")
        .first()
    )
    if hit:
        return hit

    spec_key = normalize_finance_material_spec_key(code)
    if not spec_key:
        return None

    active_rows = await base_qs.filter(effective_to__isnull=True).order_by("-id").all()
    if not active_rows:
        active_rows = (
            await base_qs.filter(effective_to__gte=today).order_by("-effective_from", "-id").all()
        )

    matches = [
        row
        for row in active_rows
        if normalize_finance_material_spec_key(row.spec) == spec_key
        or normalize_finance_material_spec_key(row.material_code) == spec_key
    ]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        for row in matches:
            if normalize_finance_material_spec_key(row.spec) == spec_key:
                return row
        return matches[0]
    return None


async def _write_change_log(
    *,
    tenant_id: int,
    supplier_id: int,
    material_code: str,
    material_name: str,
    old_unit_price: Decimal | None,
    new_unit_price: Decimal,
    change_source: str,
    previous_price_id: int | None,
    supplier_price_id: int | None,
    operator: User | None,
    remark: str | None = None,
) -> HaoligoFinancePriceChangeLog:
    return await HaoligoFinancePriceChangeLog.create(
        tenant_id=tenant_id,
        supplier_id=supplier_id,
        supplier_price_id=supplier_price_id,
        previous_price_id=previous_price_id,
        material_code=material_code,
        material_name=material_name,
        old_unit_price=old_unit_price,
        new_unit_price=new_unit_price,
        change_source=change_source,
        operator_user_id=operator.id if operator else None,
        operator_user_name=(operator.full_name or operator.username if operator else None),
        remark=remark,
    )


async def create_supplier_price_row(
    *,
    tenant_id: int,
    supplier: HaoligoFinanceSupplier,
    material_code: str,
    material_name: str,
    unit_price: Decimal,
    price_type: str,
    unit_price_literal: str | None = None,
    spec: str | None = None,
    unit: str | None = None,
    tax_rate: Decimal | None = None,
    material_id: int | None = None,
    remark: str | None = None,
    change_source: str = FINANCE_PRICE_CHANGE_SOURCE_MANUAL,
    operator: User | None = None,
    close_existing: bool = True,
) -> HaoligoFinanceSupplierPrice:
    code = (material_code or "").strip()
    name = (material_name or "").strip()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="物料编码不能为空")
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="物料名称不能为空")
    if unit_price is None or unit_price < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="单价无效")
    pt = _validate_price_type(price_type)
    literal = resolve_unit_price_literal(unit_price, unit_price_literal)

    old_row: HaoligoFinanceSupplierPrice | None = None
    if close_existing:
        old_row = await find_active_price(tenant_id, supplier.id, code)
        if old_row:
            today = _today()
            old_row.is_active = False
            old_row.effective_to = today
            await old_row.save()

    today = _today()
    new_row = await HaoligoFinanceSupplierPrice.create(
        tenant_id=tenant_id,
        supplier_id=supplier.id,
        material_code=code,
        material_name=name,
        spec=(spec or "").strip() or None,
        unit=(unit or "").strip() or None,
        unit_price=unit_price,
        unit_price_literal=literal,
        price_type=pt,
        tax_rate=tax_rate,
        material_id=material_id,
        effective_from=today,
        effective_to=None,
        is_active=True,
        remark=(remark or "").strip() or None,
    )

    if old_row or change_source != FINANCE_PRICE_CHANGE_SOURCE_MANUAL:
        await _write_change_log(
            tenant_id=tenant_id,
            supplier_id=supplier.id,
            material_code=code,
            material_name=name,
            old_unit_price=old_row.unit_price if old_row else None,
            new_unit_price=unit_price,
            change_source=change_source,
            previous_price_id=old_row.id if old_row else None,
            supplier_price_id=new_row.id,
            operator=operator,
        )

    return new_row


async def change_supplier_price(
    *,
    tenant_id: int,
    price_row: HaoligoFinanceSupplierPrice,
    new_unit_price: Decimal,
    operator: User | None,
    change_source: str = FINANCE_PRICE_CHANGE_SOURCE_MANUAL,
    remark: str | None = None,
    new_unit_price_literal: str | None = None,
) -> HaoligoFinanceSupplierPrice:
    if new_unit_price is None or new_unit_price < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="单价无效")
    new_literal = resolve_unit_price_literal(new_unit_price, new_unit_price_literal)
    old_literal = price_row.unit_price_literal or resolve_unit_price_literal(price_row.unit_price)
    if price_row.unit_price == new_unit_price and old_literal == new_literal:
        return price_row
    supplier = await get_supplier_or_404(tenant_id, price_row.supplier_id)
    return await create_supplier_price_row(
        tenant_id=tenant_id,
        supplier=supplier,
        material_code=price_row.material_code,
        material_name=price_row.material_name,
        unit_price=new_unit_price,
        unit_price_literal=new_literal,
        price_type=price_row.price_type,
        spec=price_row.spec,
        unit=price_row.unit,
        tax_rate=price_row.tax_rate,
        material_id=price_row.material_id,
        remark=remark or price_row.remark,
        change_source=change_source,
        operator=operator,
        close_existing=True,
    )


async def quick_add_supplier_price(
    *,
    tenant_id: int,
    supplier_id: int,
    material_code: str,
    material_name: str,
    unit_price: Decimal,
    unit_price_literal: str | None = None,
    price_type: str,
    spec: str | None = None,
    unit: str | None = None,
    tax_rate: Decimal | None = None,
    material_id: int | None = None,
    operator: User | None = None,
) -> HaoligoFinanceSupplierPrice:
    supplier = await get_supplier_or_404(tenant_id, supplier_id)
    existing = await find_active_price(tenant_id, supplier_id, material_code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该物料已有有效单价，请使用改价",
        )
    return await create_supplier_price_row(
        tenant_id=tenant_id,
        supplier=supplier,
        material_code=material_code,
        material_name=material_name,
        unit_price=unit_price,
        unit_price_literal=unit_price_literal,
        price_type=price_type,
        spec=spec,
        unit=unit,
        tax_rate=tax_rate,
        material_id=material_id,
        change_source=FINANCE_PRICE_CHANGE_SOURCE_QUICK_ADD,
        operator=operator,
        close_existing=False,
    )
