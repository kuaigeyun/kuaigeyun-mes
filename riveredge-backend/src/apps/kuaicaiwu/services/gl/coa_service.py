"""会计科目维护与行业模板。"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.models.account_balance import AccountBalance
from apps.kuaicaiwu.models.voucher_line import VoucherLine
from apps.kuaicaiwu.services.gl.coa_templates import (
    DEFAULT_COA_TEMPLATE_KEY,
    get_coa_template,
    list_coa_templates,
)
from apps.kuaicaiwu.services.gl.settings_service import GlSettingsService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CoaService:
    @staticmethod
    def code_lengths_from_rule(rule: str) -> List[int]:
        parts = [int(x) for x in str(rule or "4-2-2-2").split("-") if str(x).isdigit()]
        if not parts:
            parts = [4, 2, 2, 2]
        lengths: List[int] = []
        acc = 0
        for p in parts:
            acc += p
            lengths.append(acc)
        return lengths

    async def _assert_code_rule(
        self,
        tenant_id: int,
        *,
        account_code: str,
        level: int,
        parent: Optional[ChartOfAccount] = None,
    ) -> None:
        settings = await GlSettingsService().get_or_create(tenant_id)
        lengths = self.code_lengths_from_rule(settings.account_code_rule or "4-2-2-2")
        if level < 1 or level > len(lengths):
            raise ValidationError(
                f"科目级次超出账套规则 {settings.account_code_rule}（最多 {len(lengths)} 级）"
            )
        expected = lengths[level - 1]
        if len(account_code) != expected:
            raise ValidationError(
                f"科目编码长度须为 {expected}（规则 {settings.account_code_rule}，第 {level} 级）"
            )
        if parent:
            if not account_code.startswith(parent.account_code):
                raise ValidationError("下级科目编码必须以父级编码为前缀")
            parent_len = lengths[int(parent.level or 1) - 1] if int(parent.level or 1) <= len(lengths) else len(parent.account_code)
            if len(parent.account_code) != parent_len and len(parent.account_code) >= expected:
                pass

    async def list_accounts(
        self,
        tenant_id: int,
        *,
        is_active: Optional[bool] = None,
        account_type: Optional[str] = None,
    ) -> List[ChartOfAccount]:
        q = ChartOfAccount.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            q = q.filter(is_active=is_active)
        if account_type:
            q = q.filter(account_type=account_type)
        return await q.order_by("account_code").all()

    async def create_account(self, tenant_id: int, data: Dict[str, Any]) -> ChartOfAccount:
        code = str(data.get("account_code") or "").strip()
        if not code:
            raise ValidationError("科目编码必填")
        exists = await ChartOfAccount.filter(
            tenant_id=tenant_id, account_code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"科目编码已存在: {code}")

        parent_id = data.get("parent_id")
        level = 1
        parent = None
        if parent_id:
            parent = await ChartOfAccount.get_or_none(
                tenant_id=tenant_id, id=parent_id, deleted_at__isnull=True
            )
            if not parent:
                raise NotFoundError("上级科目不存在")
            level = int(parent.level or 1) + 1
            if parent.is_leaf:
                parent.is_leaf = False
                await parent.save()

        await self._assert_code_rule(tenant_id, account_code=code, level=level, parent=parent)

        row = await ChartOfAccount.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            account_code=code,
            account_name=str(data.get("account_name") or "").strip(),
            account_type=str(data.get("account_type") or "asset"),
            parent_id=parent_id,
            level=level,
            is_leaf=bool(data.get("is_leaf", True)),
            balance_direction=str(data.get("balance_direction") or "debit"),
            is_cash_journal=bool(data.get("is_cash_journal", False)),
            is_bank_journal=bool(data.get("is_bank_journal", False)),
            is_controlled=bool(data.get("is_controlled", False)),
            aux_customer=bool(data.get("aux_customer", False)),
            aux_supplier=bool(data.get("aux_supplier", False)),
            aux_department=bool(data.get("aux_department", False)),
            aux_employee=bool(data.get("aux_employee", False)),
            aux_project=bool(data.get("aux_project", False)),
            is_active=bool(data.get("is_active", True)),
            notes=data.get("notes"),
        )
        return row

    async def update_account(self, tenant_id: int, account_id: int, data: Dict[str, Any]) -> ChartOfAccount:
        row = await ChartOfAccount.get_or_none(
            tenant_id=tenant_id, id=account_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("科目不存在")
        has_activity = await self._has_activity(tenant_id, account_id)
        locked = {
            "aux_customer",
            "aux_supplier",
            "aux_department",
            "aux_employee",
            "aux_project",
            "account_code",
            "account_type",
        }
        for key, value in data.items():
            if key in locked and has_activity and getattr(row, key, None) != value:
                raise ValidationError("科目已有发生额或余额，禁止修改编码/类型/辅助核算")
            if hasattr(row, key) and key not in {"id", "tenant_id", "uuid"}:
                setattr(row, key, value)
        await row.save()
        return row

    async def delete_account(self, tenant_id: int, account_id: int) -> None:
        row = await ChartOfAccount.get_or_none(
            tenant_id=tenant_id, id=account_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("科目不存在")
        if await self._has_activity(tenant_id, account_id):
            raise ValidationError("科目已有发生额或余额，禁止删除")
        children = await ChartOfAccount.filter(
            tenant_id=tenant_id, parent_id=account_id, deleted_at__isnull=True
        ).exists()
        if children:
            raise ValidationError("存在下级科目，禁止删除")
        from core.utils.timezone_utils import resolve_business_datetime

        row.deleted_at = resolve_business_datetime()
        row.is_active = False
        await row.save()

    async def seed_industry_template(
        self, tenant_id: int, template_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """按所选准则/行业模板导入一级科目；已存在编码跳过，不覆盖已改名称。"""
        try:
            meta = get_coa_template(template_key)
        except KeyError:
            raise ValidationError(
                f"未知科目模板：{template_key or DEFAULT_COA_TEMPLATE_KEY}。"
                f"可用：{', '.join(t['key'] for t in list_coa_templates())}"
            ) from None

        accounts: List[Dict[str, Any]] = list(meta["accounts"])
        settings = await GlSettingsService().get_or_create(tenant_id)
        rule = str(settings.account_code_rule or "").strip()
        if not rule.startswith("4"):
            settings.account_code_rule = str(meta.get("account_code_rule") or "4-2-2-2")
            await settings.save()

        created = 0
        skipped = 0
        for item in accounts:
            exists = await ChartOfAccount.filter(
                tenant_id=tenant_id, account_code=item["account_code"], deleted_at__isnull=True
            ).exists()
            if exists:
                skipped += 1
                continue
            await ChartOfAccount.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                level=1,
                is_leaf=True,
                is_active=True,
                **item,
            )
            created += 1
        return {
            "created": created,
            "skipped": skipped,
            "total_seed": len(accounts),
            "template": meta["key"],
            "template_name": meta["name"],
        }

    def list_seed_templates(self) -> List[Dict[str, Any]]:
        return list_coa_templates()

    async def _has_activity(self, tenant_id: int, account_id: int) -> bool:
        if await VoucherLine.filter(tenant_id=tenant_id, account_id=account_id).exists():
            return True
        return await AccountBalance.filter(
            tenant_id=tenant_id, account_id=account_id, deleted_at__isnull=True
        ).exists()

    def to_dict(self, row: ChartOfAccount) -> Dict[str, Any]:
        return {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "account_code": row.account_code,
            "account_name": row.account_name,
            "account_type": row.account_type,
            "parent_id": row.parent_id,
            "level": row.level,
            "is_leaf": row.is_leaf,
            "balance_direction": row.balance_direction,
            "is_cash_journal": row.is_cash_journal,
            "is_bank_journal": row.is_bank_journal,
            "is_controlled": row.is_controlled,
            "aux_customer": row.aux_customer,
            "aux_supplier": row.aux_supplier,
            "aux_department": row.aux_department,
            "aux_employee": getattr(row, "aux_employee", False),
            "aux_project": getattr(row, "aux_project", False),
            "is_active": row.is_active,
            "notes": row.notes,
        }
