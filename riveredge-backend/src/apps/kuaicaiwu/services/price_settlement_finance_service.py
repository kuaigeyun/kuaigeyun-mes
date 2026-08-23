"""月结定价财务差额服务"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional, Tuple

from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.constants.finance_source_types import (
    PAYABLE_SOURCE_PRICE_SETTLEMENT,
    RECEIVABLE_SOURCE_PRICE_SETTLEMENT,
)
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.services.finance_service import ReceivableService, PayableService
from apps.kuaicaiwu.schemas.finance import PayableCreate, ReceivableCreate
from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import ValidationError

_MONEY = Decimal("0.01")


class PriceSettlementFinanceService(AppBaseService):
    def _q(self, value: Decimal | float | int | str) -> Decimal:
        return Decimal(str(value or 0)).quantize(_MONEY)

    async def create_adjustment_for_line(
        self,
        tenant_id: int,
        *,
        side: str,
        partner_id: int,
        partner_name: str,
        source_order_id: int,
        source_order_code: str,
        settlement_line_id: int,
        delta_amount: Decimal,
        business_date,
        operator_id: int,
        notes: str,
    ) -> Tuple[Optional[int], Optional[str]]:
        amount = self._q(delta_amount)
        if amount == 0:
            return None, None

        abs_amount = abs(amount)
        if side == "sales":
            existing = await Receivable.get_or_none(
                tenant_id=tenant_id,
                source_type=RECEIVABLE_SOURCE_PRICE_SETTLEMENT,
                source_id=settlement_line_id,
                deleted_at__isnull=True,
            )
            if existing:
                return existing.id, "receivable"

            customer = await Customer.get_or_none(id=partner_id, deleted_at__isnull=True)
            payment_terms = getattr(customer, "payment_terms_days", None)
            due_days = int(payment_terms or 30)
            due_date = business_date
            if hasattr(business_date, "day"):
                from datetime import timedelta
                due_date = business_date + timedelta(days=due_days)

            receivable_service = ReceivableService()
            code = await receivable_service.generate_code(
                tenant_id, "RECEIVABLE_CODE", prefix=f"YS{today_site_str()}"
            )
            signed_total = amount
            async with in_transaction():
                receivable = await Receivable.create(
                    tenant_id=tenant_id,
                    receivable_code=code,
                    source_type=RECEIVABLE_SOURCE_PRICE_SETTLEMENT,
                    source_id=settlement_line_id,
                    source_code=source_order_code,
                    customer_id=partner_id,
                    customer_name=partner_name,
                    total_amount=signed_total,
                    received_amount=Decimal("0"),
                    remaining_amount=signed_total,
                    due_date=due_date,
                    payment_terms=str(payment_terms) if payment_terms else None,
                    status="未收款" if signed_total > 0 else "已收款",
                    business_date=business_date,
                    review_status="草稿",
                    notes=notes,
                    created_by=operator_id,
                    updated_by=operator_id,
                )
            from apps.kuaicaiwu.services.finance_audit_workflow import submit_finance_review

            await submit_finance_review(
                model=Receivable,
                tenant_id=tenant_id,
                doc_id=int(receivable.id),
                updated_by=operator_id,
                doc_label="应收单",
                node_key="receivable",
            )
            return receivable.id, "receivable"

        if side == "purchase":
            existing = await Payable.get_or_none(
                tenant_id=tenant_id,
                source_type=PAYABLE_SOURCE_PRICE_SETTLEMENT,
                source_id=settlement_line_id,
                deleted_at__isnull=True,
            )
            if existing:
                return existing.id, "payable"

            supplier = await Supplier.get_or_none(id=partner_id, deleted_at__isnull=True)
            payment_terms = getattr(supplier, "payment_terms_days", None)
            due_days = int(payment_terms or 30)
            due_date = business_date
            if hasattr(business_date, "day"):
                from datetime import timedelta
                due_date = business_date + timedelta(days=due_days)

            payable_service = PayableService()
            code = await payable_service.generate_code(
                tenant_id, "PAYABLE_CODE", prefix=f"YF{today_site_str()}"
            )
            signed_total = amount
            async with in_transaction():
                payable = await Payable.create(
                    tenant_id=tenant_id,
                    payable_code=code,
                    source_type=PAYABLE_SOURCE_PRICE_SETTLEMENT,
                    source_id=settlement_line_id,
                    source_code=source_order_code,
                    supplier_id=partner_id,
                    supplier_name=partner_name,
                    total_amount=signed_total,
                    paid_amount=Decimal("0"),
                    remaining_amount=signed_total,
                    due_date=due_date,
                    payment_terms=str(payment_terms) if payment_terms else None,
                    status="未付款" if signed_total > 0 else "已付款",
                    business_date=business_date,
                    review_status="草稿",
                    notes=notes,
                    created_by=operator_id,
                    updated_by=operator_id,
                )
            from apps.kuaicaiwu.services.finance_audit_workflow import submit_finance_review

            await submit_finance_review(
                model=Payable,
                tenant_id=tenant_id,
                doc_id=int(payable.id),
                updated_by=operator_id,
                doc_label="应付单",
                node_key="payable",
            )
            return payable.id, "payable"

        raise ValidationError(f"不支持的定价方向: {side}")
