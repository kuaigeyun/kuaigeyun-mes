"""
凭证模板：根据会计事件类型生成草稿分录结构。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.accounting_event import AccountingEvent
from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount


class VoucherTemplateService:
    """业务事件 -> 凭证分录模板映射。"""

    DEFAULT_TEMPLATES: Dict[str, List[Dict[str, str]]] = {
        "sales_delivery_confirmed": [
            {"side": "debit", "account_code": "1122", "summary": "应收账款"},
            {"side": "credit", "account_code": "6001", "summary": "主营业务收入"},
        ],
        "purchase_receipt_confirmed": [
            {"side": "debit", "account_code": "1403", "summary": "原材料"},
            {"side": "credit", "account_code": "2202", "summary": "应付账款"},
        ],
        "receipt_confirmed": [
            {"side": "debit", "account_code": "1002", "summary": "银行存款"},
            {"side": "credit", "account_code": "1122", "summary": "应收账款"},
        ],
        "payment_confirmed": [
            {"side": "debit", "account_code": "2202", "summary": "应付账款"},
            {"side": "credit", "account_code": "1002", "summary": "银行存款"},
        ],
    }

    async def _resolve_account(
        self, tenant_id: int, account_code: str
    ) -> Optional[ChartOfAccount]:
        return await ChartOfAccount.filter(
            tenant_id=tenant_id,
            account_code=account_code,
            is_active=True,
            deleted_at__isnull=True,
        ).first()

    async def build_draft_lines_from_event(
        self,
        tenant_id: int,
        event: AccountingEvent,
    ) -> List[Dict[str, Any]]:
        template_key = event.event_type or event.business_type or ""
        rows = self.DEFAULT_TEMPLATES.get(template_key, [])
        if not rows:
            rows = self.DEFAULT_TEMPLATES.get("sales_delivery_confirmed", [])

        amount = Decimal(str(event.amount or 0))
        if amount <= 0:
            return []

        lines: List[Dict[str, Any]] = []
        for idx, row in enumerate(rows, start=1):
            account = await self._resolve_account(tenant_id, row["account_code"])
            if not account:
                continue
            is_debit = row["side"] == "debit"
            lines.append({
                "line_no": idx,
                "account_id": account.id,
                "account_code": account.account_code,
                "account_name": account.account_name,
                "summary": row.get("summary") or event.notes,
                "debit_amount": amount if is_debit else Decimal("0"),
                "credit_amount": Decimal("0") if is_debit else amount,
            })
        return lines
