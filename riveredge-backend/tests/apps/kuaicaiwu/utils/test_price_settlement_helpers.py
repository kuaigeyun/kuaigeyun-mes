"""月结定价辅助函数单元测试"""

from decimal import Decimal

from apps.kuaicaiwu.constants.price_settlement import PriceSettlementStatus
from apps.kuaicaiwu.utils.price_settlement_helpers import (
    derive_price_settlement_status,
    derive_provisional_unit_price,
    is_monthly_settlement_method,
)


def test_is_monthly_settlement_method():
    assert is_monthly_settlement_method("monthly") is True
    assert is_monthly_settlement_method("月结") is True
    assert is_monthly_settlement_method("cash") is False
    assert is_monthly_settlement_method(None) is False


def test_derive_price_settlement_status_monthly_zero_price():
    status = derive_price_settlement_status(
        unit_price=0,
        partner_settlement_method="monthly",
    )
    assert status == PriceSettlementStatus.PROVISIONAL.value


def test_derive_price_settlement_status_non_monthly_zero_price():
    status = derive_price_settlement_status(
        unit_price=0,
        partner_settlement_method="cash",
    )
    assert status == PriceSettlementStatus.SETTLED.value


def test_derive_price_settlement_status_explicit():
    status = derive_price_settlement_status(
        unit_price=0,
        partner_settlement_method="monthly",
        explicit_status=PriceSettlementStatus.SETTLED.value,
    )
    assert status == PriceSettlementStatus.SETTLED.value


def test_derive_price_settlement_status_gift():
    status = derive_price_settlement_status(
        unit_price=0,
        is_gift=True,
        partner_settlement_method="monthly",
    )
    assert status == PriceSettlementStatus.SETTLED.value


def test_derive_provisional_unit_price():
    ref = derive_provisional_unit_price(
        unit_price=0,
        reference_price=Decimal("12.5"),
        settlement_status=PriceSettlementStatus.PROVISIONAL.value,
    )
    assert ref == Decimal("12.5")

    none_ref = derive_provisional_unit_price(
        unit_price=0,
        reference_price=None,
        settlement_status=PriceSettlementStatus.SETTLED.value,
    )
    assert none_ref is None
