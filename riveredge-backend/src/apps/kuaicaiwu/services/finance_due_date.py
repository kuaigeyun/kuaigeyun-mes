"""往来账款到期日：从客户/供应商主数据账期解析。"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier

DEFAULT_PAYMENT_TERMS_DAYS = 30


async def resolve_partner_due_date(
    tenant_id: int,
    partner_type: Literal["customer", "supplier"],
    partner_id: int,
    business_date: date,
) -> date:
    """按伙伴 payment_terms_days 计算到期日；未维护时使用组织默认 30 天。"""
    days = DEFAULT_PAYMENT_TERMS_DAYS
    if partner_type == "customer":
        partner = await Customer.get_or_none(
            tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True
        )
    else:
        partner = await Supplier.get_or_none(
            tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True
        )
    if partner and getattr(partner, "payment_terms_days", None) is not None:
        days = max(0, int(partner.payment_terms_days))
    return business_date + timedelta(days=days)
