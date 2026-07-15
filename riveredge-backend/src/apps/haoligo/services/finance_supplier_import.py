"""好力 GO — 财务材料供应商批量导入。"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException

from apps.haoligo.models.finance_supplier import HaoligoFinanceSupplier
from apps.haoligo.services.finance_supplier_price import ensure_finance_supplier_code_available


@dataclass(frozen=True)
class FinanceSupplierImportRowInput:
    supplier_code: str
    supplier_name: str
    tax_no: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    payment_terms_days: int = 0
    settlement_method: str | None = None
    is_active: bool = True
    remark: str | None = None


@dataclass
class FinanceSupplierImportOutcome:
    created_count: int
    failed_count: int
    errors: list[str]


def _optional_str(val: str | None) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s or None


async def import_finance_suppliers(
    tenant_id: int,
    rows: list[FinanceSupplierImportRowInput],
) -> FinanceSupplierImportOutcome:
    created_count = 0
    failed_count = 0
    errors: list[str] = []
    seen_codes: set[str] = set()

    for row_no, row in enumerate(rows, start=1):
        code = row.supplier_code.strip()
        name = row.supplier_name.strip()
        if code in seen_codes:
            failed_count += 1
            errors.append(f"第{row_no}行：代号「{code}」在导入文件中重复")
            continue
        seen_codes.add(code)

        try:
            await ensure_finance_supplier_code_available(tenant_id, code)
        except HTTPException as exc:
            failed_count += 1
            errors.append(f"第{row_no}行：{exc.detail}")
            continue

        await HaoligoFinanceSupplier.create(
            tenant_id=tenant_id,
            supplier_code=code,
            supplier_name=name,
            tax_no=_optional_str(row.tax_no),
            contact_name=_optional_str(row.contact_name),
            contact_phone=_optional_str(row.contact_phone),
            payment_terms_days=row.payment_terms_days,
            settlement_method=_optional_str(row.settlement_method),
            is_active=row.is_active,
            remark=_optional_str(row.remark),
        )
        created_count += 1

    return FinanceSupplierImportOutcome(
        created_count=created_count,
        failed_count=failed_count,
        errors=errors,
    )
