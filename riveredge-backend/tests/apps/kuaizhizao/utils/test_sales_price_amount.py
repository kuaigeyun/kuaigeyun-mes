"""销售行金额与发票税额计算。"""

from decimal import Decimal

from apps.kuaicaiwu.services.finance_tax import compute_tax_from_excluding, compute_tax_from_including
from apps.kuaizhizao.utils.sales_price_amount import calc_sales_line_amounts


def test_calc_sales_line_amounts_tax_inclusive_matches_order_total():
    excl, tax, incl = calc_sales_line_amounts(
        Decimal("1"),
        Decimal("66750"),
        Decimal("13"),
        "tax_inclusive",
    )
    assert incl == Decimal("66750.00")
    assert excl + tax == incl
    assert incl * Decimal("1.13") != incl  # 不应再次加税


def test_calc_sales_line_amounts_tax_exclusive_adds_tax_once():
    excl, tax, incl = calc_sales_line_amounts(
        Decimal("1"),
        Decimal("59070.80"),
        Decimal("13"),
        "tax_exclusive",
    )
    assert excl == Decimal("59070.80")
    assert incl == Decimal("66750.00")
    assert tax == Decimal("7679.20")


def test_compute_tax_from_including_reverses_excluding():
    excl, tax, total = compute_tax_from_including(Decimal("66750"), Decimal("13"))
    assert total == Decimal("66750.00")
    assert excl + tax == total
    roundtrip_excl, roundtrip_tax, roundtrip_total = compute_tax_from_excluding(excl, Decimal("13"))
    assert roundtrip_total == total
    assert roundtrip_excl == excl
    assert roundtrip_tax == tax
