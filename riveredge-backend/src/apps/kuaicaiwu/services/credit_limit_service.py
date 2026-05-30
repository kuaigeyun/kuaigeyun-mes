"""
客户信用额度校验（销售订单审核/出库确认共用）。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from apps.kuaicaiwu.models.receivable import Receivable
from apps.master_data.models.customer import Customer
from infra.exceptions.exceptions import BusinessLogicError


class CreditLimitService:
    async def is_credit_limit_enabled(self, tenant_id: int) -> bool:
        from infra.services.business_config_service import BusinessConfigService

        cfg = await BusinessConfigService().get_business_config(tenant_id)
        fin = (cfg.get("parameters") or {}).get("finance") or {}
        return bool(fin.get("credit_limit_enabled", False))

    async def validate_customer_exposure(
        self,
        *,
        tenant_id: int,
        customer_id: Optional[int],
        customer_name: Optional[str],
        additional_amount: Decimal,
        scene: str = "业务",
    ) -> None:
        if not customer_id:
            return
        if not await self.is_credit_limit_enabled(tenant_id):
            return

        customer = await Customer.get_or_none(
            tenant_id=tenant_id, id=customer_id, deleted_at__isnull=True
        )
        if not customer:
            return

        credit_limit = getattr(customer, "credit_limit", None)
        if credit_limit is None:
            return

        credit_limit = Decimal(str(credit_limit))
        if credit_limit <= Decimal("0"):
            return

        outstanding_rows = await Receivable.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            deleted_at__isnull=True,
            remaining_amount__gt=0,
        ).values_list("remaining_amount", flat=True)
        current_outstanding = sum(
            (Decimal(str(v or 0)) for v in outstanding_rows), Decimal("0")
        )
        projected = current_outstanding + Decimal(str(additional_amount or 0))

        if projected > credit_limit:
            display = customer_name or getattr(customer, "name", None) or str(customer_id)
            raise BusinessLogicError(
                f"客户 {display} 信用额度超限（{scene}）："
                f"当前应收 {current_outstanding} + 本次 {additional_amount} > 额度 {credit_limit}"
            )
