"""月结业财对账检查：应收/应付余额 vs 总账科目。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List

from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.services.gl.balance_service import BalanceService


class GlIntegrationReconcileService:
    async def month_end_checks(
        self,
        tenant_id: int,
        year: int,
        month: int,
    ) -> Dict[str, Any]:
        checks: List[Dict[str, Any]] = []
        bals = await BalanceService().account_balance_sheet(
            tenant_id, year, month, include_unposted=False
        )

        def gl_ending(code: str) -> Decimal:
            total = Decimal("0")
            for r in bals:
                if r["account_code"] == code or str(r["account_code"]).startswith(code):
                    total += Decimal(str(r["ending_debit"])) - Decimal(str(r["ending_credit"]))
            return total

        # 应收账款业务余额（未核销）
        ar_rows = await Receivable.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
        ar_open = Decimal("0")
        for r in ar_rows:
            remaining = getattr(r, "remaining_amount", None)
            if remaining is None:
                amount = Decimal(str(getattr(r, "amount", 0) or 0))
                settled = Decimal(str(getattr(r, "settled_amount", 0) or 0))
                remaining = amount - settled
            ar_open += Decimal(str(remaining or 0))
        ar_gl = gl_ending("1122")
        checks.append(
            {
                "name": "应收账款 vs 1122",
                "business_balance": float(ar_open),
                "gl_balance": float(ar_gl),
                "diff": float(ar_open - ar_gl),
                "ok": abs(ar_open - ar_gl) < Decimal("0.01"),
            }
        )

        ap_rows = await Payable.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
        ap_open = Decimal("0")
        for r in ap_rows:
            remaining = getattr(r, "remaining_amount", None)
            if remaining is None:
                amount = Decimal(str(getattr(r, "amount", 0) or 0))
                settled = Decimal(str(getattr(r, "settled_amount", 0) or 0))
                remaining = amount - settled
            ap_open += Decimal(str(remaining or 0))
        # 应付科目贷方余额，业务正数余额对应 GL 贷方 → 用 credit-debit
        ap_gl_raw = Decimal("0")
        for r in bals:
            if r["account_code"] == "2202" or str(r["account_code"]).startswith("2202"):
                ap_gl_raw += Decimal(str(r["ending_credit"])) - Decimal(str(r["ending_debit"]))
        checks.append(
            {
                "name": "应付账款 vs 2202",
                "business_balance": float(ap_open),
                "gl_balance": float(ap_gl_raw),
                "diff": float(ap_open - ap_gl_raw),
                "ok": abs(ap_open - ap_gl_raw) < Decimal("0.01"),
            }
        )

        # 存货粗对：1403+1405 期末借方（仅提示，无数量账则仅金额）
        inv_gl = gl_ending("1403") + gl_ending("1405")
        checks.append(
            {
                "name": "存货科目余额（1403+1405）",
                "business_balance": None,
                "gl_balance": float(inv_gl),
                "diff": None,
                "ok": True,
                "note": "存货数量金额以仓储/成本模块为准，此处仅列示总账余额供核对",
            }
        )

        return {
            "period": f"{year:04d}-{month:02d}",
            "ok": all(c.get("ok") for c in checks if c.get("business_balance") is not None),
            "checks": checks,
        }

    async def generate_vouchers_from_pending_events(
        self,
        tenant_id: int,
        operator_id: int,
        *,
        limit: int = 100,
    ) -> Dict[str, Any]:
        from apps.kuaicaiwu.models.accounting_event import AccountingEvent
        from apps.kuaicaiwu.models.voucher import Voucher
        from apps.kuaicaiwu.services.posting_service import PostingService

        events = await AccountingEvent.filter(tenant_id=tenant_id).order_by("-id").limit(limit * 3)
        posting = PostingService()
        created = []
        skipped = 0
        for ev in events:
            exists = await Voucher.filter(
                tenant_id=tenant_id,
                source_event_id=ev.id,
                deleted_at__isnull=True,
            ).exclude(status="cancelled").exists()
            if exists:
                skipped += 1
                continue
            try:
                v = await posting.create_draft_voucher_from_event(tenant_id, ev.id, operator_id)
                created.append(posting.voucher_to_dict(v))
                if len(created) >= limit:
                    break
            except Exception:
                skipped += 1
                continue
        return {"created_count": len(created), "skipped": skipped, "vouchers": created}
