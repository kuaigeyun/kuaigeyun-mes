"""银行账户收/付款方式匹配"""

from apps.kuaicaiwu.services.bank_account_service import BankAccountService


def test_resolve_payment_method_for_account_type():
    assert BankAccountService.resolve_payment_method_for_account_type("bank") == "银行转账"
    assert BankAccountService.resolve_payment_method_for_account_type("cash") == "现金"
    assert BankAccountService.resolve_payment_method_for_account_type("CASH") == "现金"
    assert BankAccountService.resolve_payment_method_for_account_type(None) == "银行转账"
