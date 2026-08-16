"""补种 2221 增值税明细科目。"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List

from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.services.gl.coa_service import CoaService
from apps.kuaicaiwu.services.tax.tax_constants import SURCHARGE_ACCOUNTS, VAT_DETAIL_ACCOUNTS
from apps.kuaicaiwu.services.tax.tax_settings_service import TaxSettingsService
from infra.exceptions.exceptions import ValidationError


class TaxCoaService:
    def __init__(self) -> None:
        self.coa_service = CoaService()
        self.settings_service = TaxSettingsService()

    async def _ensure_parent(
        self,
        tenant_id: int,
        *,
        account_code: str,
        account_name: str,
        parent: ChartOfAccount,
        is_leaf: bool,
    ) -> ChartOfAccount:
        existing = await ChartOfAccount.get_or_none(
            tenant_id=tenant_id,
            account_code=account_code,
            deleted_at__isnull=True,
        )
        if existing:
            if not existing.is_leaf and is_leaf:
                existing.is_leaf = True
                await existing.save()
            elif existing.is_leaf and not is_leaf:
                existing.is_leaf = False
                await existing.save()
            return existing
        level = int(parent.level or 1) + 1
        return await ChartOfAccount.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            account_code=account_code,
            account_name=account_name,
            account_type=parent.account_type,
            parent_id=parent.id,
            level=level,
            is_leaf=is_leaf,
            balance_direction=parent.balance_direction,
            is_active=True,
        )

    async def supplement_tax_accounts(self, tenant_id: int) -> Dict[str, Any]:
        root = await ChartOfAccount.get_or_none(
            tenant_id=tenant_id,
            account_code="2221",
            deleted_at__isnull=True,
        )
        if not root:
            raise ValidationError("未找到一级科目 2221 应交税费，请先导入科目模板")

        created: List[str] = []
        bindings_update: Dict[str, int] = {}

        for spec in VAT_DETAIL_ACCOUNTS + SURCHARGE_ACCOUNTS:
            code = spec["account_code"]
            parent_code = spec["parent_code"]
            parent = root if parent_code == "2221" else await ChartOfAccount.get_or_none(
                tenant_id=tenant_id,
                account_code=parent_code,
                deleted_at__isnull=True,
            )
            if not parent:
                raise ValidationError(f"上级科目 {parent_code} 不存在，无法补种 {code}")
            before = await ChartOfAccount.filter(
                tenant_id=tenant_id, account_code=code, deleted_at__isnull=True
            ).exists()
            row = await self._ensure_parent(
                tenant_id,
                account_code=code,
                account_name=spec["account_name"],
                parent=parent,
                is_leaf=bool(spec.get("is_leaf", True)),
            )
            if not before:
                created.append(code)

            binding_map = {
                "22210101": "output_vat",
                "22210102": "input_vat",
                "22210103": "input_transfer_out",
                "22210104": "paid_vat",
                "22210105": "transfer_unpaid_vat",
                "222102": "urban_construction",
                "222103": "education",
                "222104": "local_education",
            }
            if code in binding_map:
                bindings_update[binding_map[code]] = row.id

        expense = await ChartOfAccount.get_or_none(
            tenant_id=tenant_id,
            account_code="6403",
            deleted_at__isnull=True,
        )
        if expense:
            bindings_update["tax_surcharge_expense"] = expense.id

        settings = await self.settings_service.get_or_create(tenant_id)
        merged = dict(settings.account_bindings or {})
        for key, val in bindings_update.items():
            merged.setdefault(key, val)
        settings.account_bindings = merged
        await settings.save()

        return {"created_codes": created, "account_bindings": merged}
