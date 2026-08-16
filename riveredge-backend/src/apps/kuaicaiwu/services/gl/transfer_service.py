"""期末转账与结转损益。"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.models.gl_transfer_template import GlTransferTemplate
from apps.kuaicaiwu.models.account_balance import AccountBalance
from apps.kuaicaiwu.services.posting_service import PostingService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class GlTransferService:
    async def list_templates(self, tenant_id: int) -> List[GlTransferTemplate]:
        return await GlTransferTemplate.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).order_by("template_code").all()

    async def upsert_template(self, tenant_id: int, data: Dict[str, Any]) -> GlTransferTemplate:
        code = str(data.get("template_code") or "").strip()
        if not code:
            raise ValidationError("模板编码必填")
        row = await GlTransferTemplate.get_or_none(
            tenant_id=tenant_id, template_code=code, deleted_at__isnull=True
        )
        if row:
            row.template_name = str(data.get("template_name") or row.template_name)
            row.template_type = str(data.get("template_type") or row.template_type)
            row.lines = data.get("lines") or row.lines
            row.is_active = bool(data.get("is_active", row.is_active))
            await row.save()
            return row
        return await GlTransferTemplate.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            template_code=code,
            template_name=str(data.get("template_name") or code),
            template_type=str(data.get("template_type") or "custom"),
            lines=data.get("lines") or [],
            is_active=bool(data.get("is_active", True)),
        )

    async def run_template(
        self,
        tenant_id: int,
        template_id: int,
        year: int,
        month: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        tpl = await GlTransferTemplate.get_or_none(
            tenant_id=tenant_id, id=template_id, deleted_at__isnull=True
        )
        if not tpl or not tpl.is_active:
            raise NotFoundError("转账模板不存在或已停用")
        if tpl.template_type == "profit_loss":
            return await self.run_profit_loss_transfer(tenant_id, year, month, operator_id)
        return await self._run_custom_template(tenant_id, tpl, year, month, operator_id)

    async def _period_net(self, tenant_id: int, account_id: int, year: int, month: int) -> Decimal:
        bals = await AccountBalance.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            account_id=account_id,
            deleted_at__isnull=True,
        ).all()
        debit = sum(Decimal(str(b.period_debit or 0)) for b in bals)
        credit = sum(Decimal(str(b.period_credit or 0)) for b in bals)
        return debit - credit

    async def _period_side(
        self, tenant_id: int, account_id: int, year: int, month: int, side: str
    ) -> Decimal:
        bals = await AccountBalance.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            account_id=account_id,
            deleted_at__isnull=True,
        ).all()
        if side == "credit":
            return sum(Decimal(str(b.period_credit or 0)) for b in bals)
        return sum(Decimal(str(b.period_debit or 0)) for b in bals)

    async def _ending_balance(
        self, tenant_id: int, account_id: int, year: int, month: int
    ) -> Decimal:
        bals = await AccountBalance.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            account_id=account_id,
            deleted_at__isnull=True,
        ).all()
        debit = sum(Decimal(str(b.ending_debit or 0)) for b in bals)
        credit = sum(Decimal(str(b.ending_credit or 0)) for b in bals)
        return abs(debit - credit)

    async def _run_custom_template(
        self,
        tenant_id: int,
        tpl: GlTransferTemplate,
        year: int,
        month: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        """
        自定义转账：
        lines: [{side, account_code, summary, amount_mode: fixed|period_balance|period_debit|period_credit|ending_balance, amount?, ratio?}]
        period_* 取该科目本期发生/余额；ratio 为比例（默认 1）。
        """
        specs = list(tpl.lines or [])
        if len(specs) < 2:
            raise ValidationError("自定义转账模板至少两行分录")

        resolved_amounts: List[Decimal] = []
        accounts: List[ChartOfAccount] = []
        for spec in specs:
            code = str(spec.get("account_code") or "").strip()
            account = await ChartOfAccount.filter(
                tenant_id=tenant_id, account_code=code, deleted_at__isnull=True
            ).first()
            if not account:
                raise ValidationError(f"模板科目不存在: {code}")
            accounts.append(account)
            mode = str(spec.get("amount_mode") or "fixed")
            ratio = Decimal(str(spec.get("ratio") or 1))
            if mode == "period_balance":
                net = await self._period_net(tenant_id, account.id, year, month)
                base = abs(net)
            elif mode == "period_debit":
                base = await self._period_side(tenant_id, account.id, year, month, "debit")
            elif mode == "period_credit":
                base = await self._period_side(tenant_id, account.id, year, month, "credit")
            elif mode == "ending_balance":
                base = await self._ending_balance(tenant_id, account.id, year, month)
            else:
                base = Decimal(str(spec.get("amount") or 0))
            resolved_amounts.append((base * ratio).quantize(Decimal("0.01")))

        # 若仅一行有金额，复制到金额为0的行（结转对方）
        nonzero = [a for a in resolved_amounts if a > 0]
        if len(nonzero) == 1:
            fill = nonzero[0]
            resolved_amounts = [fill if a <= 0 else a for a in resolved_amounts]

        lines: List[Dict[str, Any]] = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        for spec, account, amount in zip(specs, accounts, resolved_amounts):
            if amount <= 0:
                continue
            side = str(spec.get("side") or "debit")
            entry = {
                "account_id": account.id,
                "summary": spec.get("summary") or tpl.template_name,
                "debit_amount": amount if side == "debit" else 0,
                "credit_amount": amount if side == "credit" else 0,
            }
            total_debit += Decimal(str(entry["debit_amount"]))
            total_credit += Decimal(str(entry["credit_amount"]))
            lines.append(entry)

        if not lines:
            return {"created": False, "message": "模板本期无可结转金额"}
        if total_debit != total_credit:
            raise ValidationError(f"自定义转账借贷不平衡: 借 {total_debit} 贷 {total_credit}")

        posting = PostingService()
        voucher = await posting.create_manual_voucher(
            tenant_id,
            operator_id,
            {
                "voucher_date": f"{year:04d}-{month:02d}-28",
                "period_year": year,
                "period_month": month,
                "summary": f"{tpl.template_name} {year:04d}-{month:02d}",
                "voucher_word": "记",
                "lines": lines,
            },
            allow_controlled=True,
        )
        return {"created": True, "voucher": posting.voucher_to_dict(voucher)}

    async def ensure_profit_loss_template(self, tenant_id: int) -> GlTransferTemplate:
        existing = await GlTransferTemplate.get_or_none(
            tenant_id=tenant_id,
            template_type="profit_loss",
            deleted_at__isnull=True,
        )
        if existing:
            return existing
        return await GlTransferTemplate.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            template_code="PL_CLOSE",
            template_name="结转损益",
            template_type="profit_loss",
            lines=[
                {"role": "pl_accounts", "account_type": "profit_loss"},
                {"role": "target", "account_code": "4103", "summary": "结转本年利润"},
            ],
            is_active=True,
        )

    async def run_profit_loss_transfer(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        """将损益类科目本期余额结转到本年利润，生成已审核凭证草稿供记账。"""
        await self.ensure_profit_loss_template(tenant_id)
        target = await ChartOfAccount.filter(
            tenant_id=tenant_id,
            account_code="4103",
            deleted_at__isnull=True,
        ).first()
        if not target:
            raise ValidationError("请先维护本年利润科目 4103")

        pl_accounts = await ChartOfAccount.filter(
            tenant_id=tenant_id,
            account_type__in=["profit_loss", "revenue", "expense"],
            is_leaf=True,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        lines: List[Dict[str, Any]] = []
        net = Decimal("0")
        for acc in pl_accounts:
            bals = await AccountBalance.filter(
                tenant_id=tenant_id,
                period_year=year,
                period_month=month,
                account_id=acc.id,
                deleted_at__isnull=True,
            ).all()
            period_debit = sum(Decimal(str(b.period_debit or 0)) for b in bals)
            period_credit = sum(Decimal(str(b.period_credit or 0)) for b in bals)
            # 结转：贷方余额科目借方冲减；借方余额科目贷方冲减
            balance = period_credit - period_debit
            if balance == 0:
                continue
            if balance > 0:
                # 收入类贷方余额 → 借记损益科目
                lines.append(
                    {
                        "account_id": acc.id,
                        "summary": f"结转{acc.account_name}",
                        "debit_amount": balance,
                        "credit_amount": 0,
                    }
                )
                net += balance
            else:
                amt = -balance
                lines.append(
                    {
                        "account_id": acc.id,
                        "summary": f"结转{acc.account_name}",
                        "debit_amount": 0,
                        "credit_amount": amt,
                    }
                )
                net -= amt

        if not lines:
            return {"created": False, "message": "本期无损益发生额可结转"}

        if net > 0:
            lines.append(
                {
                    "account_id": target.id,
                    "summary": "结转本年利润",
                    "debit_amount": 0,
                    "credit_amount": net,
                }
            )
        elif net < 0:
            lines.append(
                {
                    "account_id": target.id,
                    "summary": "结转本年利润",
                    "debit_amount": -net,
                    "credit_amount": 0,
                }
            )

        posting = PostingService()
        voucher = await posting.create_manual_voucher(
            tenant_id,
            operator_id,
            {
                "voucher_date": f"{year:04d}-{month:02d}-28",
                "period_year": year,
                "period_month": month,
                "summary": f"结转损益 {year:04d}-{month:02d}",
                "voucher_word": "记",
                "lines": lines,
            },
            allow_controlled=True,
        )
        return {"created": True, "voucher": posting.voucher_to_dict(voucher)}
