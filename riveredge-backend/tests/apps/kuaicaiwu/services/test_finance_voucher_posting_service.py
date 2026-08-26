"""收付款单过账服务测试。"""

from apps.kuaicaiwu.services.finance_voucher_posting_service import FinanceVoucherPostingService


def test_posting_service_instantiates():
    assert FinanceVoucherPostingService() is not None
