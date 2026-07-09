"""好力 GO — 供应商价格明细批量导入。"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from apps.haoligo.constants.finance_supplier_price import (
    FINANCE_PRICE_CHANGE_SOURCE_IMPORT,
    FINANCE_PRICE_TYPE_TAX_EXCLUSIVE,
)
from apps.haoligo.models.finance_supplier import HaoligoFinanceSupplier
from apps.haoligo.services.finance_supplier_price import (
    change_supplier_price,
    create_supplier_price_row,
    find_active_price,
    get_or_create_supplier_by_name,
    resolve_supplier_by_name,
)
from apps.haoligo.utils.finance_decimal import resolve_unit_price_literal


@dataclass(frozen=True)
class FinanceSupplierPriceImportRowInput:
    supplier_name: str
    spec: str
    unit_price: Decimal
    unit_price_literal: str
    remark: str | None = None


@dataclass
class FinanceSupplierPriceImportOutcome:
    created_count: int
    updated_count: int
    suppliers_created_count: int
    failed_count: int
    errors: list[str]


async def _resolve_supplier_for_import(
    tenant_id: int,
    row_no: int,
    supplier_name: str,
) -> tuple[HaoligoFinanceSupplier | None, bool, str | None]:
    """返回 (供应商, 是否新建供应商, 错误信息)。"""
    name = supplier_name.strip()
    existing = await resolve_supplier_by_name(tenant_id, name)
    if existing:
        return existing, False, None

    fuzzy_count = await HaoligoFinanceSupplier.filter(
        tenant_id=tenant_id,
        supplier_name__icontains=name,
        deleted_at__isnull=True,
    ).count()
    if fuzzy_count > 1:
        return (
            None,
            False,
            f"第{row_no}行：供应商「{name}」匹配到多条记录，请先在供应商台账明确名称",
        )

    supplier, created = await get_or_create_supplier_by_name(tenant_id, name)
    return supplier, created, None


async def import_finance_supplier_prices(
    tenant_id: int,
    rows: list[FinanceSupplierPriceImportRowInput],
    *,
    operator,
) -> FinanceSupplierPriceImportOutcome:
    created_count = 0
    updated_count = 0
    suppliers_created_count = 0
    failed_count = 0
    errors: list[str] = []
    supplier_cache: dict[str, HaoligoFinanceSupplier] = {}

    for row_no, row in enumerate(rows, start=1):
        supplier_name = row.supplier_name.strip()
        spec = row.spec.strip()
        if not supplier_name:
            failed_count += 1
            errors.append(f"第{row_no}行：供应商不能为空")
            continue
        if not spec:
            failed_count += 1
            errors.append(f"第{row_no}行：规格不能为空")
            continue
        if row.unit_price is None or row.unit_price < 0:
            failed_count += 1
            errors.append(f"第{row_no}行：不含税单价无效")
            continue

        if supplier_name not in supplier_cache:
            supplier, supplier_created, err = await _resolve_supplier_for_import(
                tenant_id, row_no, supplier_name
            )
            if err:
                failed_count += 1
                errors.append(err)
                continue
            supplier_cache[supplier_name] = supplier
            if supplier_created:
                suppliers_created_count += 1
        supplier = supplier_cache[supplier_name]

        material_code = spec
        existing = await find_active_price(tenant_id, supplier.id, material_code)
        if existing:
            existing_literal = existing.unit_price_literal or resolve_unit_price_literal(existing.unit_price)
            if existing_literal == row.unit_price_literal and (existing.remark or "") == (row.remark or ""):
                continue
            if existing_literal != row.unit_price_literal:
                await change_supplier_price(
                    tenant_id=tenant_id,
                    price_row=existing,
                    new_unit_price=row.unit_price,
                    new_unit_price_literal=row.unit_price_literal,
                    operator=operator,
                    change_source=FINANCE_PRICE_CHANGE_SOURCE_IMPORT,
                    remark=row.remark or existing.remark,
                )
                updated_count += 1
            else:
                existing.remark = row.remark
                await existing.save()
                updated_count += 1
            continue

        await create_supplier_price_row(
            tenant_id=tenant_id,
            supplier=supplier,
            material_code=material_code,
            material_name=spec,
            unit_price=row.unit_price,
            unit_price_literal=row.unit_price_literal,
            price_type=FINANCE_PRICE_TYPE_TAX_EXCLUSIVE,
            spec=spec,
            remark=row.remark,
            change_source=FINANCE_PRICE_CHANGE_SOURCE_IMPORT,
            operator=operator,
            close_existing=False,
        )
        created_count += 1

    return FinanceSupplierPriceImportOutcome(
        created_count=created_count,
        updated_count=updated_count,
        suppliers_created_count=suppliers_created_count,
        failed_count=failed_count,
        errors=errors,
    )
