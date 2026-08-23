"""月结定价辅助函数"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from apps.kuaicaiwu.constants.price_settlement import (
    MONTHLY_SETTLEMENT_METHOD_CODES,
    PriceSettlementStatus,
)


def is_monthly_settlement_method(code: Optional[str]) -> bool:
    if not code:
        return False
    normalized = str(code).strip().lower()
    return normalized in MONTHLY_SETTLEMENT_METHOD_CODES or normalized == "月结"


def derive_price_settlement_status(
    *,
    unit_price: Decimal | float | int,
    is_gift: bool = False,
    partner_settlement_method: Optional[str] = None,
    explicit_status: Optional[str] = None,
) -> str:
    if explicit_status in (
        PriceSettlementStatus.PROVISIONAL.value,
        PriceSettlementStatus.SETTLED.value,
    ):
        return explicit_status
    if is_gift:
        return PriceSettlementStatus.SETTLED.value
    price = Decimal(str(unit_price or 0))
    if is_monthly_settlement_method(partner_settlement_method) and price <= 0:
        return PriceSettlementStatus.PROVISIONAL.value
    return PriceSettlementStatus.SETTLED.value


def derive_provisional_unit_price(
    *,
    unit_price: Decimal | float | int,
    reference_price: Optional[Decimal | float | int],
    settlement_status: str,
) -> Optional[Decimal]:
    if settlement_status != PriceSettlementStatus.PROVISIONAL.value:
        return None
    ref = reference_price if reference_price is not None else unit_price
    ref_dec = Decimal(str(ref or 0))
    return ref_dec if ref_dec > 0 else None
