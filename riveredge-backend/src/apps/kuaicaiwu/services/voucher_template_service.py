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

    EVENT_ALIASES: Dict[str, str] = {
        "SALES_DELIVERY_TO_RECEIVABLE": "sales_delivery_confirmed",
        "RECEIVABLE_CREATED": "sales_delivery_confirmed",
        "sales_delivery_confirmed": "sales_delivery_confirmed",
        "PURCHASE_RECEIPT_TO_PAYABLE": "purchase_receipt_confirmed",
        "PAYABLE_CREATED": "purchase_receipt_confirmed",
        "purchase_receipt_confirmed": "purchase_receipt_confirmed",
        "PURCHASE_INVOICE_CREATED": "purchase_invoice",
        "INVOICE_CREATED": "sales_invoice",
        "SALES_INVOICE_CREATED": "sales_invoice",
        "SALES_RETURN_TO_RECEIVABLE": "sales_return",
        "PURCHASE_RETURN_TO_PAYABLE": "purchase_return",
        "RECEIPT_CONFIRMED": "receipt_confirmed",
        "receipt_confirmed": "receipt_confirmed",
        "SETTLEMENT_RECEIVABLE_COMPLETED": "receipt_confirmed",
        "PAYMENT_CONFIRMED": "payment_confirmed",
        "payment_confirmed": "payment_confirmed",
        "SETTLEMENT_PAYABLE_COMPLETED": "payment_confirmed",
        "SALES_ORDER_TO_PREPAYMENT": "customer_prepayment",
        "PURCHASE_ORDER_TO_PREPAYMENT": "supplier_prepayment",
        # 存货出入库 / 成本结转（有事件时按模板生成）
        "INVENTORY_RECEIPT": "inventory_receipt",
        "INVENTORY_ISSUE": "inventory_issue",
        "COGS_TRANSFER": "cogs_transfer",
        "WAREHOUSE_INBOUND": "inventory_receipt",
        "WAREHOUSE_OUTBOUND": "inventory_issue",
        "FA_DEPRECIATION": "fa_depreciation",
        "FA_DISPOSAL": "fa_disposal",
        "FIXED_ASSET_DEPRECIATION": "fa_depreciation",
        "FIXED_ASSET_DISPOSAL": "fa_disposal",
    }

    DEFAULT_TEMPLATES: Dict[str, List[Dict[str, str]]] = {
        "sales_delivery_confirmed": [
            {"side": "debit", "account_code": "1122", "summary": "应收账款", "aux": "customer"},
            {"side": "credit", "account_code": "6001", "summary": "主营业务收入", "aux": "customer"},
        ],
        "sales_invoice": [
            {"side": "debit", "account_code": "1122", "summary": "应收账款", "aux": "customer"},
            {"side": "credit", "account_code": "6001", "summary": "主营业务收入", "aux": "customer"},
        ],
        "sales_return": [
            {"side": "debit", "account_code": "6001", "summary": "主营业务收入红字", "aux": "customer"},
            {"side": "credit", "account_code": "1122", "summary": "应收账款红字", "aux": "customer"},
        ],
        "purchase_receipt_confirmed": [
            {"side": "debit", "account_code": "1403", "summary": "原材料"},
            {"side": "credit", "account_code": "2202", "summary": "应付账款", "aux": "supplier"},
        ],
        "purchase_invoice": [
            {"side": "debit", "account_code": "1403", "summary": "原材料"},
            {"side": "credit", "account_code": "2202", "summary": "应付账款", "aux": "supplier"},
        ],
        "purchase_return": [
            {"side": "debit", "account_code": "2202", "summary": "应付账款红字", "aux": "supplier"},
            {"side": "credit", "account_code": "1403", "summary": "原材料红字"},
        ],
        "receipt_confirmed": [
            {"side": "debit", "account_code": "1002", "summary": "银行存款"},
            {"side": "credit", "account_code": "1122", "summary": "应收账款", "aux": "customer"},
        ],
        "payment_confirmed": [
            {"side": "debit", "account_code": "2202", "summary": "应付账款", "aux": "supplier"},
            {"side": "credit", "account_code": "1002", "summary": "银行存款"},
        ],
        "customer_prepayment": [
            {"side": "debit", "account_code": "1002", "summary": "银行存款"},
            {"side": "credit", "account_code": "2203", "summary": "预收账款", "aux": "customer"},
        ],
        "supplier_prepayment": [
            {"side": "debit", "account_code": "1123", "summary": "预付账款", "aux": "supplier"},
            {"side": "credit", "account_code": "1002", "summary": "银行存款"},
        ],
        "inventory_receipt": [
            {"side": "debit", "account_code": "1403", "summary": "原材料入库"},
            {"side": "credit", "account_code": "2202", "summary": "应付账款", "aux": "supplier"},
        ],
        "inventory_issue": [
            {"side": "debit", "account_code": "6401", "summary": "主营业务成本"},
            {"side": "credit", "account_code": "1405", "summary": "库存商品出库"},
        ],
        "cogs_transfer": [
            {"side": "debit", "account_code": "6401", "summary": "结转销售成本"},
            {"side": "credit", "account_code": "1405", "summary": "库存商品"},
        ],
        "fa_depreciation": [
            {"side": "debit", "account_code": "6602", "summary": "计提折旧"},
            {"side": "credit", "account_code": "1602", "summary": "累计折旧"},
        ],
        "fa_disposal": [
            {"side": "debit", "account_code": "1602", "summary": "转出累计折旧"},
            {"side": "credit", "account_code": "1601", "summary": "转出固定资产原值"},
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

    def _partner_from_event(self, event: AccountingEvent) -> Dict[str, Any]:
        payload = event.payload or {}
        return {
            "customer_id": payload.get("customer_id") or payload.get("partner_id"),
            "customer_name": payload.get("customer_name") or payload.get("partner_name"),
            "supplier_id": payload.get("supplier_id") or payload.get("partner_id"),
            "supplier_name": payload.get("supplier_name") or payload.get("partner_name"),
            "department_id": payload.get("department_id"),
            "department_name": payload.get("department_name"),
        }

    async def build_draft_lines_from_event(
        self,
        tenant_id: int,
        event: AccountingEvent,
    ) -> List[Dict[str, Any]]:
        raw_key = event.event_type or event.business_type or ""
        template_key = self.EVENT_ALIASES.get(raw_key, raw_key)
        rows = self.DEFAULT_TEMPLATES.get(template_key, [])
        if not rows:
            return []

        amount = Decimal(str(event.amount or 0))
        if amount <= 0:
            return []

        partner = self._partner_from_event(event)
        lines: List[Dict[str, Any]] = []
        for idx, row in enumerate(rows, start=1):
            account = await self._resolve_account(tenant_id, row["account_code"])
            if not account:
                continue
            is_debit = row["side"] == "debit"
            line: Dict[str, Any] = {
                "line_no": idx,
                "account_id": account.id,
                "account_code": account.account_code,
                "account_name": account.account_name,
                "summary": row.get("summary") or event.notes,
                "debit_amount": amount if is_debit else Decimal("0"),
                "credit_amount": Decimal("0") if is_debit else amount,
            }
            aux = row.get("aux")
            if aux == "customer" or account.aux_customer:
                line["customer_id"] = partner.get("customer_id")
                line["customer_name"] = partner.get("customer_name")
            if aux == "supplier" or account.aux_supplier:
                line["supplier_id"] = partner.get("supplier_id")
                line["supplier_name"] = partner.get("supplier_name")
            if account.aux_department:
                line["department_id"] = partner.get("department_id")
                line["department_name"] = partner.get("department_name")
            lines.append(line)
        return lines
