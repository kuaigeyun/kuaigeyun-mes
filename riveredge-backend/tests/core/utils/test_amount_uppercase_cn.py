from decimal import Decimal

from core.utils.amount_uppercase_cn import amount_to_cn_uppercase, enrich_print_amount_uppercase_fields


def test_amount_to_cn_uppercase_integer():
    assert amount_to_cn_uppercase(Decimal("1705400")) == "壹佰柒拾万伍仟肆佰元整"
    assert amount_to_cn_uppercase(100100) == "壹拾万壹佰元整"


def test_amount_to_cn_uppercase_fraction():
    assert amount_to_cn_uppercase("12.34") == "壹拾贰元叁角肆分"
    assert amount_to_cn_uppercase(0) == "零元整"


def test_amount_to_cn_uppercase_invalid_returns_empty():
    assert amount_to_cn_uppercase(None) == ""
    assert amount_to_cn_uppercase("") == ""
    assert amount_to_cn_uppercase("abc") == ""


def test_enrich_print_amount_uppercase_fields():
    data = {"total_amount": "1234.56", "currency_code": "CNY"}
    enrich_print_amount_uppercase_fields(data)
    assert data["total_amount_uppercase"] == "壹仟贰佰叁拾肆元伍角陆分"
    assert data["released_amount_uppercase"] == ""
    assert data["remaining_amount_uppercase"] == ""


def test_enrich_print_amount_uppercase_fields_none_amount():
    data = {"total_amount": None, "currency_code": "CNY"}
    enrich_print_amount_uppercase_fields(data)
    assert data["total_amount_uppercase"] == ""
