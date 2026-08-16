"""轻量出纳：现金/银行日记账、银行对账、余额调节表。"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.bank_reconcile_item import BankReconcileItem
from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.models.voucher import Voucher
from apps.kuaicaiwu.models.voucher_line import VoucherLine
from apps.kuaicaiwu.services.gl.settings_service import GlSettingsService
from apps.kuaicaiwu.services.gl.balance_service import BalanceService
from infra.exceptions.exceptions import ValidationError
from core.utils.timezone_utils import resolve_business_datetime


class GlCashierService:
    async def cash_bank_journal(
        self,
        tenant_id: int,
        year: int,
        month: int,
        *,
        kind: str = "bank",
        account_id: Optional[int] = None,
        include_unposted: bool = False,
    ) -> Dict[str, Any]:
        settings = await GlSettingsService().get_or_create(tenant_id)
        if kind == "cash":
            ids = list(settings.cash_account_ids or [])
            if not ids:
                accounts = await ChartOfAccount.filter(
                    tenant_id=tenant_id, is_cash_journal=True, deleted_at__isnull=True
                ).all()
                ids = [a.id for a in accounts]
        else:
            ids = list(settings.bank_account_ids or [])
            if not ids:
                accounts = await ChartOfAccount.filter(
                    tenant_id=tenant_id, is_bank_journal=True, deleted_at__isnull=True
                ).all()
                ids = [a.id for a in accounts]
        if account_id:
            ids = [account_id] if account_id in ids or True else [account_id]

        if not ids:
            return {"entries": [], "account_ids": []}

        target_id = account_id or ids[0]
        detail = await BalanceService().detail_ledger(
            tenant_id,
            year,
            month,
            target_id,
            include_unposted=include_unposted,
        )
        return {**detail, "kind": kind, "account_ids": ids}

    async def list_reconcile_items(
        self,
        tenant_id: int,
        gl_account_id: int,
        year: int,
        month: int,
        *,
        side: Optional[str] = None,
        unmatched_only: bool = False,
    ) -> List[Dict[str, Any]]:
        q = BankReconcileItem.filter(
            tenant_id=tenant_id,
            gl_account_id=gl_account_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if side:
            q = q.filter(side=side)
        if unmatched_only:
            q = q.filter(is_matched=False)
        rows = await q.order_by("txn_date", "id").all()
        return [self._item_dict(r) for r in rows]

    async def add_bank_statement_item(self, tenant_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        row = await BankReconcileItem.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            gl_account_id=int(data["gl_account_id"]),
            period_year=int(data["period_year"]),
            period_month=int(data["period_month"]),
            side="bank",
            txn_date=data["txn_date"],
            summary=data.get("summary"),
            debit_amount=Decimal(str(data.get("debit_amount") or 0)),
            credit_amount=Decimal(str(data.get("credit_amount") or 0)),
            is_opening=bool(data.get("is_opening", False)),
        )
        return self._item_dict(row)

    async def sync_enterprise_from_journal(
        self,
        tenant_id: int,
        gl_account_id: int,
        year: int,
        month: int,
    ) -> Dict[str, Any]:
        """从已记账银行科目分录同步企业账侧对账条目。"""
        vouchers = await Voucher.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            status="posted",
            deleted_at__isnull=True,
        ).all()
        created = 0
        for v in vouchers:
            lines = await VoucherLine.filter(
                tenant_id=tenant_id, voucher_id=v.id, account_id=gl_account_id
            ).all()
            for line in lines:
                exists = await BankReconcileItem.filter(
                    tenant_id=tenant_id,
                    voucher_line_id=line.id,
                    deleted_at__isnull=True,
                ).exists()
                if exists:
                    continue
                await BankReconcileItem.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    gl_account_id=gl_account_id,
                    period_year=year,
                    period_month=month,
                    side="enterprise",
                    txn_date=v.voucher_date,
                    summary=line.summary or v.summary,
                    debit_amount=line.debit_amount,
                    credit_amount=line.credit_amount,
                    voucher_id=v.id,
                    voucher_line_id=line.id,
                )
                created += 1
        return {"created": created}

    async def match_items(self, tenant_id: int, item_ids: List[int]) -> Dict[str, Any]:
        if len(item_ids) < 2:
            raise ValidationError("至少勾对两条记录")
        rows = await BankReconcileItem.filter(
            tenant_id=tenant_id, id__in=item_ids, deleted_at__isnull=True
        ).all()
        if len(rows) != len(item_ids):
            raise ValidationError("对账条目不完整")
        if any(r.is_matched for r in rows):
            raise ValidationError("存在已勾对记录")
        group = str(uuid.uuid4())
        for r in rows:
            r.is_matched = True
            r.match_group = group
            await r.save()
        return {"matched": len(rows), "match_group": group}

    async def unmatch_group(self, tenant_id: int, match_group: str) -> Dict[str, Any]:
        rows = await BankReconcileItem.filter(
            tenant_id=tenant_id, match_group=match_group, deleted_at__isnull=True
        ).all()
        for r in rows:
            r.is_matched = False
            r.match_group = None
            await r.save()
        return {"unmatched": len(rows)}

    async def balance_adjustment_sheet(
        self,
        tenant_id: int,
        gl_account_id: int,
        year: int,
        month: int,
        *,
        book_balance: Optional[float] = None,
        bank_balance: Optional[float] = None,
    ) -> Dict[str, Any]:
        """余额调节表：企业账面余额 ± 未达账项 = 银行余额 ± 未达账项。"""
        bals = await BalanceService().account_balance_sheet(
            tenant_id, year, month, include_unposted=False
        )
        leaf = next((b for b in bals if b["account_id"] == gl_account_id and not b.get("customer_id") and not b.get("supplier_id") and not b.get("department_id")), None)
        if book_balance is None:
            if leaf:
                book_balance = float(leaf["ending_debit"] or 0) - float(leaf["ending_credit"] or 0)
            else:
                book_balance = 0.0
        bank_balance = float(bank_balance or 0)

        items = await BankReconcileItem.filter(
            tenant_id=tenant_id,
            gl_account_id=gl_account_id,
            period_year=year,
            period_month=month,
            is_matched=False,
            deleted_at__isnull=True,
        ).all()
        # 企业已记银行未达：enterprise unmatched
        ent_unrec_add = sum(float(i.debit_amount or 0) for i in items if i.side == "enterprise")
        ent_unrec_sub = sum(float(i.credit_amount or 0) for i in items if i.side == "enterprise")
        # 银行已记企业未达：bank unmatched
        bank_unrec_add = sum(float(i.debit_amount or 0) for i in items if i.side == "bank")
        bank_unrec_sub = sum(float(i.credit_amount or 0) for i in items if i.side == "bank")

        adjusted_book = book_balance + bank_unrec_add - bank_unrec_sub
        adjusted_bank = bank_balance + ent_unrec_add - ent_unrec_sub
        return {
            "book_balance": book_balance,
            "bank_balance": bank_balance,
            "enterprise_unrecorded_debit": bank_unrec_add,
            "enterprise_unrecorded_credit": bank_unrec_sub,
            "bank_unrecorded_debit": ent_unrec_add,
            "bank_unrecorded_credit": ent_unrec_sub,
            "adjusted_book_balance": adjusted_book,
            "adjusted_bank_balance": adjusted_bank,
            "balanced": abs(adjusted_book - adjusted_bank) < 0.005,
            "unmatched_items": [self._item_dict(i) for i in items],
        }

    def _item_dict(self, row: BankReconcileItem) -> Dict[str, Any]:
        return {
            "id": row.id,
            "gl_account_id": row.gl_account_id,
            "period_year": row.period_year,
            "period_month": row.period_month,
            "side": row.side,
            "txn_date": row.txn_date.isoformat() if row.txn_date else None,
            "summary": row.summary,
            "debit_amount": float(row.debit_amount or 0),
            "credit_amount": float(row.credit_amount or 0),
            "is_opening": row.is_opening,
            "is_matched": row.is_matched,
            "match_group": row.match_group,
            "voucher_id": row.voucher_id,
            "voucher_line_id": row.voucher_line_id,
        }
