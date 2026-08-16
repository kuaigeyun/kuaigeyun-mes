"""科目余额：记账写入真源；账表查询。"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.transactions import in_transaction

from apps.kuaicaiwu.models.account_balance import AccountBalance
from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.models.voucher import Voucher
from apps.kuaicaiwu.models.voucher_line import VoucherLine
from infra.exceptions.exceptions import ValidationError


def _d(v: Any) -> Decimal:
    return Decimal(str(v or 0))


def _aux_key(
    customer_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    department_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    project_id: Optional[int] = None,
) -> Tuple[int, int, int, int, int]:
    return (
        int(customer_id or 0),
        int(supplier_id or 0),
        int(department_id or 0),
        int(employee_id or 0),
        int(project_id or 0),
    )


class BalanceService:
    async def get_or_create_balance(
        self,
        tenant_id: int,
        year: int,
        month: int,
        account: ChartOfAccount,
        customer_id: int = 0,
        supplier_id: int = 0,
        department_id: int = 0,
        employee_id: int = 0,
        project_id: int = 0,
    ) -> AccountBalance:
        row = await AccountBalance.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            account_id=account.id,
            customer_id=customer_id,
            supplier_id=supplier_id,
            department_id=department_id,
            employee_id=employee_id,
            project_id=project_id,
            deleted_at__isnull=True,
        )
        if row:
            return row
        return await AccountBalance.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            period_year=year,
            period_month=month,
            account_id=account.id,
            account_code=account.account_code,
            customer_id=customer_id,
            supplier_id=supplier_id,
            department_id=department_id,
            employee_id=employee_id,
            project_id=project_id,
        )

    def _recompute_ending(self, row: AccountBalance) -> None:
        # 期末借 = 期初借 + 本期借；期末贷 = 期初贷 + 本期贷；再轧差到单方
        debit = _d(row.opening_debit) + _d(row.period_debit)
        credit = _d(row.opening_credit) + _d(row.period_credit)
        if debit >= credit:
            row.ending_debit = debit - credit
            row.ending_credit = Decimal("0")
        else:
            row.ending_credit = credit - debit
            row.ending_debit = Decimal("0")

    async def apply_voucher_lines(
        self,
        tenant_id: int,
        voucher: Voucher,
        lines: List[VoucherLine],
        *,
        sign: int = 1,
    ) -> None:
        """sign=1 记账；sign=-1 反记账。"""
        for line in lines:
            account = await ChartOfAccount.get_or_none(
                tenant_id=tenant_id, id=line.account_id, deleted_at__isnull=True
            )
            if not account:
                raise ValidationError(f"科目不存在: {line.account_id}")
            cid, sid, did, eid, pid = _aux_key(
                line.customer_id,
                line.supplier_id,
                line.department_id,
                line.employee_id,
                line.project_id,
            )
            row = await self.get_or_create_balance(
                tenant_id,
                voucher.period_year,
                voucher.period_month,
                account,
                cid,
                sid,
                did,
                eid,
                pid,
            )
            debit = _d(line.debit_amount) * sign
            credit = _d(line.credit_amount) * sign
            row.period_debit = _d(row.period_debit) + debit
            row.period_credit = _d(row.period_credit) + credit
            row.year_debit = _d(row.year_debit) + debit
            row.year_credit = _d(row.year_credit) + credit
            self._recompute_ending(row)
            await row.save()

    async def set_opening_balances(
        self,
        tenant_id: int,
        year: int,
        month: int,
        items: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """期初录入（开账前）。每项含 account_id、opening_debit/credit、辅助。"""
        saved = 0
        async with in_transaction():
            for item in items:
                account = await ChartOfAccount.get_or_none(
                    tenant_id=tenant_id, id=item["account_id"], deleted_at__isnull=True
                )
                if not account:
                    raise ValidationError(f"科目不存在: {item.get('account_id')}")
                if not account.is_leaf:
                    raise ValidationError(f"仅末级科目可录入期初: {account.account_code}")
                cid, sid, did, eid, pid = _aux_key(
                    item.get("customer_id"),
                    item.get("supplier_id"),
                    item.get("department_id"),
                    item.get("employee_id"),
                    item.get("project_id"),
                )
                row = await self.get_or_create_balance(
                    tenant_id, year, month, account, cid, sid, did, eid, pid
                )
                row.opening_debit = _d(item.get("opening_debit"))
                row.opening_credit = _d(item.get("opening_credit"))
                row.period_debit = Decimal("0")
                row.period_credit = Decimal("0")
                row.year_debit = row.opening_debit
                row.year_credit = row.opening_credit
                self._recompute_ending(row)
                await row.save()
                saved += 1
        trial = await self.trial_balance(tenant_id, year, month, include_unposted=False)
        return {"saved": saved, "trial": trial}

    async def roll_opening_to_next(
        self,
        tenant_id: int,
        year: int,
        month: int,
        next_year: int,
        next_month: int,
    ) -> None:
        rows = await AccountBalance.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        ).all()
        for src in rows:
            account = await ChartOfAccount.get_or_none(
                tenant_id=tenant_id, id=src.account_id, deleted_at__isnull=True
            )
            if not account:
                continue
            dst = await self.get_or_create_balance(
                tenant_id,
                next_year,
                next_month,
                account,
                src.customer_id,
                src.supplier_id,
                src.department_id,
                getattr(src, "employee_id", 0) or 0,
                getattr(src, "project_id", 0) or 0,
            )
            dst.opening_debit = src.ending_debit
            dst.opening_credit = src.ending_credit
            if next_year != year:
                dst.year_debit = Decimal("0")
                dst.year_credit = Decimal("0")
            else:
                dst.year_debit = src.year_debit
                dst.year_credit = src.year_credit
            self._recompute_ending(dst)
            await dst.save()

    async def _unposted_delta(
        self, tenant_id: int, year: int, month: int
    ) -> Dict[Tuple[int, int, int, int, int, int], Dict[str, Decimal]]:
        """account_id+aux -> period debit/credit from draft/reviewed."""
        vouchers = await Voucher.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            status__in=["draft", "reviewed"],
            deleted_at__isnull=True,
        ).all()
        result: Dict[Tuple[int, int, int, int, int, int], Dict[str, Decimal]] = {}
        for v in vouchers:
            lines = await VoucherLine.filter(tenant_id=tenant_id, voucher_id=v.id).all()
            for line in lines:
                key = (
                    line.account_id,
                    *_aux_key(
                        line.customer_id,
                        line.supplier_id,
                        line.department_id,
                        line.employee_id,
                        line.project_id,
                    ),
                )
                bucket = result.setdefault(
                    key, {"debit": Decimal("0"), "credit": Decimal("0"), "code": line.account_code}
                )
                bucket["debit"] += _d(line.debit_amount)
                bucket["credit"] += _d(line.credit_amount)
        return result

    async def account_balance_sheet(
        self,
        tenant_id: int,
        year: int,
        month: int,
        *,
        include_unposted: bool = False,
        account_code_from: Optional[str] = None,
        account_code_to: Optional[str] = None,
        aux_only: bool = False,
        customer_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        department_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        project_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        q = AccountBalance.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if customer_id is not None:
            q = q.filter(customer_id=customer_id)
        if supplier_id is not None:
            q = q.filter(supplier_id=supplier_id)
        if department_id is not None:
            q = q.filter(department_id=department_id)
        if employee_id is not None:
            q = q.filter(employee_id=employee_id)
        if project_id is not None:
            q = q.filter(project_id=project_id)
        rows = await q.order_by("account_code").all()
        unposted = await self._unposted_delta(tenant_id, year, month) if include_unposted else {}

        by_key: Dict[Tuple[int, int, int, int, int, int], Dict[str, Any]] = {}
        for row in rows:
            key = (
                row.account_id,
                row.customer_id,
                row.supplier_id,
                row.department_id,
                row.employee_id,
                row.project_id,
            )
            by_key[key] = {
                "account_id": row.account_id,
                "account_code": row.account_code,
                "customer_id": row.customer_id or None,
                "supplier_id": row.supplier_id or None,
                "department_id": row.department_id or None,
                "employee_id": row.employee_id or None,
                "project_id": row.project_id or None,
                "opening_debit": float(row.opening_debit),
                "opening_credit": float(row.opening_credit),
                "period_debit": float(row.period_debit),
                "period_credit": float(row.period_credit),
                "year_debit": float(row.year_debit),
                "year_credit": float(row.year_credit),
                "ending_debit": float(row.ending_debit),
                "ending_credit": float(row.ending_credit),
            }

        if include_unposted:
            for key, delta in unposted.items():
                account_id, cid, sid, did, eid, pid = key
                item = by_key.get(key)
                if not item:
                    item = {
                        "account_id": account_id,
                        "account_code": delta.get("code"),
                        "customer_id": cid or None,
                        "supplier_id": sid or None,
                        "department_id": did or None,
                        "employee_id": eid or None,
                        "project_id": pid or None,
                        "opening_debit": 0.0,
                        "opening_credit": 0.0,
                        "period_debit": 0.0,
                        "period_credit": 0.0,
                        "year_debit": 0.0,
                        "year_credit": 0.0,
                        "ending_debit": 0.0,
                        "ending_credit": 0.0,
                    }
                    by_key[key] = item
                item["period_debit"] += float(delta["debit"])
                item["period_credit"] += float(delta["credit"])
                item["year_debit"] += float(delta["debit"])
                item["year_credit"] += float(delta["credit"])
                od, oc = Decimal(str(item["opening_debit"])), Decimal(str(item["opening_credit"]))
                pd, pc = Decimal(str(item["period_debit"])), Decimal(str(item["period_credit"]))
                debit, credit = od + pd, oc + pc
                if debit >= credit:
                    item["ending_debit"] = float(debit - credit)
                    item["ending_credit"] = 0.0
                else:
                    item["ending_credit"] = float(credit - debit)
                    item["ending_debit"] = 0.0

        result = list(by_key.values())
        if account_code_from:
            result = [r for r in result if str(r["account_code"]) >= account_code_from]
        if account_code_to:
            result = [r for r in result if str(r["account_code"]) <= account_code_to]
        if aux_only:
            result = [
                r
                for r in result
                if r.get("customer_id")
                or r.get("supplier_id")
                or r.get("department_id")
                or r.get("employee_id")
                or r.get("project_id")
            ]

        # 补科目名称
        accounts = {
            a.id: a
            for a in await ChartOfAccount.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).all()
        }
        for r in result:
            acc = accounts.get(r["account_id"])
            r["account_name"] = acc.account_name if acc else ""
            r["account_type"] = acc.account_type if acc else ""
        result.sort(key=lambda x: str(x.get("account_code") or ""))
        return result

    async def trial_balance(
        self,
        tenant_id: int,
        year: int,
        month: int,
        *,
        include_unposted: bool = False,
    ) -> Dict[str, Any]:
        rows = await self.account_balance_sheet(
            tenant_id, year, month, include_unposted=include_unposted
        )
        opening_d = sum(Decimal(str(r["opening_debit"])) for r in rows)
        opening_c = sum(Decimal(str(r["opening_credit"])) for r in rows)
        period_d = sum(Decimal(str(r["period_debit"])) for r in rows)
        period_c = sum(Decimal(str(r["period_credit"])) for r in rows)
        ending_d = sum(Decimal(str(r["ending_debit"])) for r in rows)
        ending_c = sum(Decimal(str(r["ending_credit"])) for r in rows)
        return {
            "opening_debit": float(opening_d),
            "opening_credit": float(opening_c),
            "period_debit": float(period_d),
            "period_credit": float(period_c),
            "ending_debit": float(ending_d),
            "ending_credit": float(ending_c),
            "balanced": opening_d == opening_c and period_d == period_c and ending_d == ending_c,
            "rows": rows,
        }

    async def detail_ledger(
        self,
        tenant_id: int,
        year: int,
        month: int,
        account_id: int,
        *,
        include_unposted: bool = False,
        customer_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        department_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        project_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        account = await ChartOfAccount.get_or_none(
            tenant_id=tenant_id, id=account_id, deleted_at__isnull=True
        )
        if not account:
            raise ValidationError("科目不存在")

        statuses = ["posted"]
        if include_unposted:
            statuses = ["draft", "reviewed", "posted"]

        vouchers = await Voucher.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            status__in=statuses,
            deleted_at__isnull=True,
        ).order_by("voucher_date", "id").all()

        cid, sid, did, eid, pid = _aux_key(
            customer_id, supplier_id, department_id, employee_id, project_id
        )
        bal = await AccountBalance.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            account_id=account_id,
            customer_id=cid,
            supplier_id=sid,
            department_id=did,
            employee_id=eid,
            project_id=pid,
            deleted_at__isnull=True,
        )
        running_debit = _d(bal.opening_debit) if bal else Decimal("0")
        running_credit = _d(bal.opening_credit) if bal else Decimal("0")
        entries: List[Dict[str, Any]] = [
            {
                "kind": "opening",
                "summary": "期初余额",
                "debit_amount": float(running_debit),
                "credit_amount": float(running_credit),
                "balance_debit": float(running_debit if running_debit >= running_credit else 0),
                "balance_credit": float(running_credit if running_credit > running_debit else 0),
            }
        ]
        for v in vouchers:
            lines = await VoucherLine.filter(
                tenant_id=tenant_id, voucher_id=v.id, account_id=account_id
            ).order_by("line_no").all()
            for line in lines:
                if customer_id is not None and int(line.customer_id or 0) != cid:
                    continue
                if supplier_id is not None and int(line.supplier_id or 0) != sid:
                    continue
                if department_id is not None and int(line.department_id or 0) != did:
                    continue
                if employee_id is not None and int(line.employee_id or 0) != eid:
                    continue
                if project_id is not None and int(line.project_id or 0) != pid:
                    continue
                running_debit += _d(line.debit_amount)
                running_credit += _d(line.credit_amount)
                if running_debit >= running_credit:
                    bd, bc = running_debit - running_credit, Decimal("0")
                else:
                    bd, bc = Decimal("0"), running_credit - running_debit
                entries.append(
                    {
                        "kind": "entry",
                        "voucher_id": v.id,
                        "voucher_code": v.voucher_code,
                        "voucher_date": v.voucher_date.isoformat(),
                        "status": v.status,
                        "summary": line.summary or v.summary,
                        "debit_amount": float(line.debit_amount or 0),
                        "credit_amount": float(line.credit_amount or 0),
                        "balance_debit": float(bd),
                        "balance_credit": float(bc),
                        "customer_id": line.customer_id,
                        "supplier_id": line.supplier_id,
                        "department_id": line.department_id,
                        "employee_id": line.employee_id,
                        "project_id": line.project_id,
                        "cash_flow_item_id": line.cash_flow_item_id,
                    }
                )
        return {
            "account_id": account.id,
            "account_code": account.account_code,
            "account_name": account.account_name,
            "entries": entries,
        }

    async def general_ledger(
        self,
        tenant_id: int,
        year: int,
        month: int,
        *,
        include_unposted: bool = False,
    ) -> List[Dict[str, Any]]:
        """总分类账：按科目汇总本期发生与余额。"""
        return await self.account_balance_sheet(
            tenant_id, year, month, include_unposted=include_unposted
        )

    async def voucher_summary(
        self,
        tenant_id: int,
        year: int,
        month: int,
        *,
        include_unposted: bool = False,
    ) -> List[Dict[str, Any]]:
        statuses = ["posted"] if not include_unposted else ["draft", "reviewed", "posted"]
        vouchers = await Voucher.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            status__in=statuses,
            deleted_at__isnull=True,
        ).all()
        by_word: Dict[str, Dict[str, Any]] = {}
        for v in vouchers:
            word = v.voucher_word or "记"
            bucket = by_word.setdefault(
                word,
                {"voucher_word": word, "count": 0, "total_debit": Decimal("0"), "total_credit": Decimal("0")},
            )
            bucket["count"] += 1
            bucket["total_debit"] += _d(v.total_debit)
            bucket["total_credit"] += _d(v.total_credit)
        return [
            {
                "voucher_word": b["voucher_word"],
                "count": b["count"],
                "total_debit": float(b["total_debit"]),
                "total_credit": float(b["total_credit"]),
            }
            for b in by_word.values()
        ]
