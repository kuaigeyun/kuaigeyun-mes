"""其他费用收支 capabilities 与挂账门禁（纯单元）。"""

from types import SimpleNamespace

from apps.kuaicaiwu.services.document_action_policy.other_income import (
    derive_other_income_capabilities,
)
from apps.kuaicaiwu.services.document_action_policy.other_expense import (
    derive_other_expense_capabilities,
)


def test_other_income_confirm_requires_receivable_and_bank():
    row = SimpleNamespace(
        status="Approved",
        counterparty_kind="customer",
        bank_account_id=1,
    )
    caps_no_ar = derive_other_income_capabilities(row, has_receivable=False, has_receipt=False)
    assert caps_no_ar["confirm"].allowed is False
    assert caps_no_ar["confirm"].reason == "other_income.confirm.no_receivable"

    caps_ok = derive_other_income_capabilities(row, has_receivable=True, has_receipt=False)
    assert caps_ok["confirm"].allowed is True
    assert caps_ok["push_receipt"].allowed is True


def test_other_expense_confirm_requires_supplier_payable():
    row = SimpleNamespace(
        status="Approved",
        counterparty_kind="supplier",
        bank_account_id=2,
    )
    caps = derive_other_expense_capabilities(row, has_payable=True, has_payment=False)
    assert caps["push_payment"].allowed is True
