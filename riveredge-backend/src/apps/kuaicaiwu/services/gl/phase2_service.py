"""总账二期：项目字典、现金流量、摊销预提、支票。"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.models.gl_accrual_item import GlAccrualItem
from apps.kuaicaiwu.models.gl_cash_flow_item import GlCashFlowItem
from apps.kuaicaiwu.models.gl_cheque import GlCheque
from apps.kuaicaiwu.models.gl_project import GlProject
from apps.kuaicaiwu.models.voucher import Voucher
from apps.kuaicaiwu.models.voucher_line import VoucherLine
from apps.kuaicaiwu.services.posting_service import PostingService
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import NotFoundError, ValidationError

DEFAULT_CASH_FLOW_SEED = [
    {"item_code": "OA01", "item_name": "销售商品提供劳务收到的现金", "category": "operating", "direction": "inflow", "sort_order": 10},
    {"item_code": "OA02", "item_name": "购买商品接受劳务支付的现金", "category": "operating", "direction": "outflow", "sort_order": 20},
    {"item_code": "OA03", "item_name": "支付给职工以及为职工支付的现金", "category": "operating", "direction": "outflow", "sort_order": 30},
    {"item_code": "IA01", "item_name": "收回投资收到的现金", "category": "investing", "direction": "inflow", "sort_order": 40},
    {"item_code": "IA02", "item_name": "购建固定资产无形资产支付的现金", "category": "investing", "direction": "outflow", "sort_order": 50},
    {"item_code": "FA01", "item_name": "吸收投资收到的现金", "category": "financing", "direction": "inflow", "sort_order": 60},
    {"item_code": "FA02", "item_name": "偿还债务支付的现金", "category": "financing", "direction": "outflow", "sort_order": 70},
]


class GlPhase2Service:
    # ---------- projects ----------
    async def list_projects(self, tenant_id: int, *, active_only: bool = True) -> List[Dict[str, Any]]:
        q = GlProject.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if active_only:
            q = q.filter(is_active=True)
        rows = await q.order_by("project_code").all()
        return [self._project_dict(r) for r in rows]

    async def upsert_project(self, tenant_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        code = str(data.get("project_code") or "").strip()
        if not code:
            raise ValidationError("项目编码必填")
        row = await GlProject.get_or_none(tenant_id=tenant_id, project_code=code, deleted_at__isnull=True)
        if row:
            row.project_name = str(data.get("project_name") or row.project_name)
            row.is_active = bool(data.get("is_active", row.is_active))
            row.notes = data.get("notes", row.notes)
            await row.save()
            return self._project_dict(row)
        row = await GlProject.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            project_code=code,
            project_name=str(data.get("project_name") or code),
            is_active=bool(data.get("is_active", True)),
            notes=data.get("notes"),
        )
        return self._project_dict(row)

    def _project_dict(self, row: GlProject) -> Dict[str, Any]:
        return {
            "id": row.id,
            "project_code": row.project_code,
            "project_name": row.project_name,
            "is_active": row.is_active,
            "notes": row.notes,
        }

    # ---------- cash flow items ----------
    async def list_cash_flow_items(self, tenant_id: int) -> List[Dict[str, Any]]:
        rows = await GlCashFlowItem.filter(tenant_id=tenant_id, deleted_at__isnull=True).order_by(
            "sort_order", "item_code"
        ).all()
        return [self._cf_dict(r) for r in rows]

    async def upsert_cash_flow_item(self, tenant_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        code = str(data.get("item_code") or "").strip()
        if not code:
            raise ValidationError("现金流量项目编码必填")
        row = await GlCashFlowItem.get_or_none(tenant_id=tenant_id, item_code=code, deleted_at__isnull=True)
        if row:
            row.item_name = str(data.get("item_name") or row.item_name)
            row.category = str(data.get("category") or row.category)
            row.direction = str(data.get("direction") or row.direction)
            row.sort_order = int(data.get("sort_order", row.sort_order))
            row.is_active = bool(data.get("is_active", row.is_active))
            await row.save()
            return self._cf_dict(row)
        row = await GlCashFlowItem.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            item_code=code,
            item_name=str(data.get("item_name") or code),
            category=str(data.get("category") or "operating"),
            direction=str(data.get("direction") or "inflow"),
            sort_order=int(data.get("sort_order") or 0),
            is_active=bool(data.get("is_active", True)),
        )
        return self._cf_dict(row)

    async def seed_cash_flow_items(self, tenant_id: int) -> Dict[str, Any]:
        created = 0
        for item in DEFAULT_CASH_FLOW_SEED:
            exists = await GlCashFlowItem.filter(
                tenant_id=tenant_id, item_code=item["item_code"], deleted_at__isnull=True
            ).exists()
            if exists:
                continue
            await GlCashFlowItem.create(tenant_id=tenant_id, uuid=str(uuid.uuid4()), **item)
            created += 1
        return {"created": created, "total_seed": len(DEFAULT_CASH_FLOW_SEED)}

    def _cf_dict(self, row: GlCashFlowItem) -> Dict[str, Any]:
        return {
            "id": row.id,
            "item_code": row.item_code,
            "item_name": row.item_name,
            "category": row.category,
            "direction": row.direction,
            "sort_order": row.sort_order,
            "is_active": row.is_active,
        }

    async def cash_flow_statement(
        self, tenant_id: int, year: int, month: int
    ) -> Dict[str, Any]:
        """按已记账现金/银行分录的现金流量项目归集（U8 式标准表）。"""
        items = await GlCashFlowItem.filter(
            tenant_id=tenant_id, is_active=True, deleted_at__isnull=True
        ).order_by("sort_order", "item_code").all()
        by_id = {r.id: r for r in items}
        totals: Dict[int, Decimal] = {r.id: Decimal("0") for r in items}

        vouchers = await Voucher.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            status="posted",
            deleted_at__isnull=True,
        ).all()
        for v in vouchers:
            lines = await VoucherLine.filter(tenant_id=tenant_id, voucher_id=v.id).all()
            for line in lines:
                account = await ChartOfAccount.get_or_none(
                    tenant_id=tenant_id, id=line.account_id, deleted_at__isnull=True
                )
                if not account or not (account.is_cash_journal or account.is_bank_journal):
                    continue
                cf_id = int(line.cash_flow_item_id or 0)
                if not cf_id or cf_id not in totals:
                    continue
                item = by_id[cf_id]
                amt = Decimal(str(line.debit_amount or 0)) + Decimal(str(line.credit_amount or 0))
                if item.direction == "outflow":
                    # 流出取贷方（现金减少）为主；若借方则仍累计绝对值
                    amt = Decimal(str(line.credit_amount or 0)) or Decimal(str(line.debit_amount or 0))
                else:
                    amt = Decimal(str(line.debit_amount or 0)) or Decimal(str(line.credit_amount or 0))
                totals[cf_id] += amt

        rows = []
        cat_sums = {"operating": Decimal("0"), "investing": Decimal("0"), "financing": Decimal("0")}
        for item in items:
            amount = totals[item.id]
            signed = amount if item.direction == "inflow" else -amount
            cat_sums[item.category] = cat_sums.get(item.category, Decimal("0")) + signed
            rows.append(
                {
                    **self._cf_dict(item),
                    "amount": float(amount),
                    "signed_amount": float(signed),
                }
            )
        net = cat_sums["operating"] + cat_sums["investing"] + cat_sums["financing"]
        return {
            "year": year,
            "month": month,
            "rows": rows,
            "operating_net": float(cat_sums["operating"]),
            "investing_net": float(cat_sums["investing"]),
            "financing_net": float(cat_sums["financing"]),
            "net_increase": float(net),
        }

    # ---------- accrual ----------
    async def list_accruals(self, tenant_id: int) -> List[Dict[str, Any]]:
        rows = await GlAccrualItem.filter(tenant_id=tenant_id, deleted_at__isnull=True).order_by(
            "item_code"
        ).all()
        return [self._accrual_dict(r) for r in rows]

    async def upsert_accrual(self, tenant_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        code = str(data.get("item_code") or "").strip()
        if not code:
            raise ValidationError("摊销预提编码必填")
        total = Decimal(str(data.get("total_amount") or 0))
        periods = max(1, int(data.get("periods") or 1))
        period_amount = Decimal(str(data.get("period_amount") or 0))
        if period_amount <= 0 and total > 0:
            period_amount = (total / periods).quantize(Decimal("0.01"))
        row = await GlAccrualItem.get_or_none(tenant_id=tenant_id, item_code=code, deleted_at__isnull=True)
        payload = {
            "item_name": str(data.get("item_name") or code),
            "accrual_type": str(data.get("accrual_type") or "accrual"),
            "total_amount": total,
            "period_amount": period_amount,
            "start_year": int(data.get("start_year") or to_site_date(resolve_business_datetime()).year),
            "start_month": int(data.get("start_month") or to_site_date(resolve_business_datetime()).month),
            "periods": periods,
            "debit_account_code": str(data.get("debit_account_code") or "").strip(),
            "credit_account_code": str(data.get("credit_account_code") or "").strip(),
            "summary": data.get("summary"),
            "is_active": bool(data.get("is_active", True)),
        }
        if not payload["debit_account_code"] or not payload["credit_account_code"]:
            raise ValidationError("借贷科目编码必填")
        if row:
            for k, v in payload.items():
                setattr(row, k, v)
            await row.save()
            return self._accrual_dict(row)
        row = await GlAccrualItem.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            item_code=code,
            amortized_amount=Decimal("0"),
            **payload,
        )
        return self._accrual_dict(row)

    async def run_accrual(
        self, tenant_id: int, accrual_id: int, year: int, month: int, operator_id: int
    ) -> Dict[str, Any]:
        row = await GlAccrualItem.get_or_none(
            tenant_id=tenant_id, id=accrual_id, deleted_at__isnull=True
        )
        if not row or not row.is_active:
            raise NotFoundError("摊销预提台账不存在或已停用")
        remaining = Decimal(str(row.total_amount)) - Decimal(str(row.amortized_amount))
        if remaining <= 0:
            return {"created": False, "message": "已摊销完毕"}
        amount = min(Decimal(str(row.period_amount)), remaining)
        if amount <= 0:
            raise ValidationError("本期摊销金额无效")
        debit = await ChartOfAccount.filter(
            tenant_id=tenant_id, account_code=row.debit_account_code, deleted_at__isnull=True
        ).first()
        credit = await ChartOfAccount.filter(
            tenant_id=tenant_id, account_code=row.credit_account_code, deleted_at__isnull=True
        ).first()
        if not debit or not credit:
            raise ValidationError("摊销科目不存在")
        posting = PostingService()
        voucher = await posting.create_manual_voucher(
            tenant_id,
            operator_id,
            {
                "voucher_date": f"{year:04d}-{month:02d}-28",
                "period_year": year,
                "period_month": month,
                "summary": row.summary or f"{row.item_name} {year}-{month:02d}",
                "voucher_word": "转",
                "lines": [
                    {
                        "account_id": debit.id,
                        "summary": row.summary or row.item_name,
                        "debit_amount": amount,
                        "credit_amount": 0,
                    },
                    {
                        "account_id": credit.id,
                        "summary": row.summary or row.item_name,
                        "debit_amount": 0,
                        "credit_amount": amount,
                    },
                ],
            },
            allow_controlled=True,
        )
        row.amortized_amount = Decimal(str(row.amortized_amount)) + amount
        await row.save()
        return {
            "created": True,
            "amount": float(amount),
            "voucher": posting.voucher_to_dict(voucher),
            "accrual": self._accrual_dict(row),
        }

    def _accrual_dict(self, row: GlAccrualItem) -> Dict[str, Any]:
        return {
            "id": row.id,
            "item_code": row.item_code,
            "item_name": row.item_name,
            "accrual_type": row.accrual_type,
            "total_amount": float(row.total_amount),
            "amortized_amount": float(row.amortized_amount),
            "period_amount": float(row.period_amount),
            "start_year": row.start_year,
            "start_month": row.start_month,
            "periods": row.periods,
            "debit_account_code": row.debit_account_code,
            "credit_account_code": row.credit_account_code,
            "summary": row.summary,
            "is_active": row.is_active,
            "remaining": float(Decimal(str(row.total_amount)) - Decimal(str(row.amortized_amount))),
        }

    # ---------- cheques ----------
    async def list_cheques(
        self, tenant_id: int, *, gl_account_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        q = GlCheque.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if gl_account_id:
            q = q.filter(gl_account_id=gl_account_id)
        rows = await q.order_by("-issue_date", "-id").all()
        return [self._cheque_dict(r) for r in rows]

    async def create_cheque(self, tenant_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        no = str(data.get("cheque_no") or "").strip()
        if not no:
            raise ValidationError("支票号必填")
        issue = data.get("issue_date") or to_site_date(resolve_business_datetime())
        if isinstance(issue, str):
            issue = date.fromisoformat(issue[:10])
        row = await GlCheque.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            cheque_no=no,
            gl_account_id=int(data["gl_account_id"]),
            issue_date=issue,
            payee=data.get("payee"),
            amount=Decimal(str(data.get("amount") or 0)),
            status="issued",
            voucher_id=data.get("voucher_id"),
            notes=data.get("notes"),
        )
        return self._cheque_dict(row)

    async def clear_cheque(self, tenant_id: int, cheque_id: int) -> Dict[str, Any]:
        row = await GlCheque.get_or_none(tenant_id=tenant_id, id=cheque_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("支票不存在")
        if row.status == "void":
            raise ValidationError("已作废支票不可核销")
        row.status = "cleared"
        row.cleared_date = to_site_date(resolve_business_datetime())
        await row.save()
        return self._cheque_dict(row)

    async def void_cheque(self, tenant_id: int, cheque_id: int) -> Dict[str, Any]:
        row = await GlCheque.get_or_none(tenant_id=tenant_id, id=cheque_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("支票不存在")
        row.status = "void"
        await row.save()
        return self._cheque_dict(row)

    def _cheque_dict(self, row: GlCheque) -> Dict[str, Any]:
        return {
            "id": row.id,
            "cheque_no": row.cheque_no,
            "gl_account_id": row.gl_account_id,
            "issue_date": row.issue_date.isoformat() if row.issue_date else None,
            "payee": row.payee,
            "amount": float(row.amount),
            "status": row.status,
            "cleared_date": row.cleared_date.isoformat() if row.cleared_date else None,
            "voucher_id": row.voucher_id,
            "notes": row.notes,
        }
