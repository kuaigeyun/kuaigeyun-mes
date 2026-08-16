"""法定三大报表轧差与科目汇总。"""

from decimal import Decimal

from apps.kuaicaiwu.services.gl.statement_service import (
    aggregate_balances_by_account,
    signed_amount,
)


def test_signed_amount_debit_and_credit():
    assert signed_amount(120, 20, "debit") == Decimal("100")
    assert signed_amount(20, 120, "credit") == Decimal("100")
    assert signed_amount(50, 50, "debit") == Decimal("0")


def test_aggregate_balances_by_account_merges_aux_rows():
    rows = [
        {
            "account_id": 1,
            "account_code": "1001",
            "account_name": "库存现金",
            "account_type": "asset",
            "ending_debit": 80,
            "ending_credit": 0,
            "opening_debit": 0,
            "opening_credit": 0,
            "period_debit": 80,
            "period_credit": 0,
            "year_debit": 80,
            "year_credit": 0,
        },
        {
            "account_id": 1,
            "account_code": "1001",
            "account_name": "库存现金",
            "account_type": "asset",
            "ending_debit": 20,
            "ending_credit": 0,
            "opening_debit": 0,
            "opening_credit": 0,
            "period_debit": 20,
            "period_credit": 0,
            "year_debit": 20,
            "year_credit": 0,
        },
    ]
    merged = aggregate_balances_by_account(rows)
    assert len(merged) == 1
    assert merged[0]["ending_debit"] == 100.0


def test_unclosed_profit_uses_credit_minus_debit():
    income_ending = signed_amount(0, 300, "credit")
    expense_ending = signed_amount(80, 0, "debit")
    unclosed = (Decimal("300") - Decimal("0")) + (Decimal("0") - Decimal("80"))
    assert income_ending == Decimal("300")
    assert expense_ending == Decimal("80")
    assert unclosed == Decimal("220")
