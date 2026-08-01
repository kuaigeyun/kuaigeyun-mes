"""销售行金额拆分（与前端 sales-orders calcSalesLineAmounts 分币舍入一致）。"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from apps.kuaizhizao.constants.price_type import normalize_price_type

_MONEY = Decimal("0.01")


def calc_sales_line_amounts(
    qty: Decimal,
    unit_price: Decimal,
    tax_rate_percent: Decimal,
    price_type: str | None,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    返回 (不含税金额, 税额, 价税合计)。

    price_type=tax_inclusive 时 unit_price 为含税单价；tax_exclusive 时为不含税单价。
    """
    q = qty or Decimal("0")
    up = unit_price or Decimal("0")
    tr = tax_rate_percent if tax_rate_percent is not None else Decimal("0")
    pt = normalize_price_type(price_type)
    unit_cents = int((up * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))

    if pt == "tax_inclusive":
        incl_cents = int((q * Decimal(unit_cents)).to_integral_value(rounding=ROUND_HALF_UP))
        factor = Decimal("1") + tr / Decimal("100")
        excl_cents = int(
            (Decimal(incl_cents) / factor).to_integral_value(rounding=ROUND_HALF_UP)
        )
        tax_cents = incl_cents - excl_cents
    else:
        excl_cents = int((q * Decimal(unit_cents)).to_integral_value(rounding=ROUND_HALF_UP))
        tax_cents = int(
            (Decimal(excl_cents) * tr / Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP)
        )
        incl_cents = excl_cents + tax_cents

    excl = (Decimal(excl_cents) / Decimal("100")).quantize(_MONEY, rounding=ROUND_HALF_UP)
    tax = (Decimal(tax_cents) / Decimal("100")).quantize(_MONEY, rounding=ROUND_HALF_UP)
    incl = (Decimal(incl_cents) / Decimal("100")).quantize(_MONEY, rounding=ROUND_HALF_UP)
    return excl, tax, incl
