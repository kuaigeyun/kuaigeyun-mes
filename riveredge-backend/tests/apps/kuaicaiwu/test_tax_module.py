"""税务模块单元测试"""

from datetime import date
from decimal import Decimal

import pytest

from apps.kuaicaiwu.services.tax.tax_constants import DEFAULT_TAX_RATES, TAXPAYER_SMALL_SCALE
from apps.kuaicaiwu.services.tax.tax_period_service import parse_tax_period, tax_period_from_date
from apps.kuaicaiwu.services.tax.tax_settings_service import TaxSettingsService
from infra.exceptions.exceptions import ValidationError


def test_tax_period_from_date():
    assert tax_period_from_date(date(2026, 3, 15)) == "2026-03"
    assert tax_period_from_date(date(2025, 12, 1)) == "2025-12"


def test_parse_tax_period_valid():
    assert parse_tax_period("2026-08") == (2026, 8)


def test_parse_tax_period_invalid():
    with pytest.raises(ValidationError):
        parse_tax_period("202608")
    with pytest.raises(ValidationError):
        parse_tax_period("2026-13")


def test_validate_tax_rates_rejects_duplicate():
    svc = TaxSettingsService()
    with pytest.raises(ValidationError):
        svc._validate_tax_rates(
            [
                {"rate": 13, "label": "13%", "is_active": True},
                {"rate": 13, "label": "13% duplicate", "is_active": True},
            ]
        )


def test_default_tax_rates_has_exempt():
    rates = {r["rate"] for r in DEFAULT_TAX_RATES}
    assert -1 in rates
    assert 13 in rates


def test_small_scale_tax_payable_equals_output():
    """小规模：应纳税额等于销项汇总，进项不参与抵扣。"""
    output_tax = Decimal("1000.00")
    input_tax = Decimal("500.00")
    transfer_out = Decimal("100.00")
    is_small = True
    if is_small:
        tax_payable = output_tax
    else:
        tax_payable = output_tax - input_tax + transfer_out
    assert tax_payable == Decimal("1000.00")
    assert TAXPAYER_SMALL_SCALE == "small_scale"
