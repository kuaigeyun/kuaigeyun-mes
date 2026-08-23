"""银行账户收/付款方式匹配与流水摘要"""

from apps.kuaicaiwu.services.bank_account_service import (
    BankAccountService,
    build_voucher_bank_summary,
)


def test_resolve_payment_method_for_account_type():
    assert BankAccountService.resolve_payment_method_for_account_type("bank") == "银行转账"
    assert BankAccountService.resolve_payment_method_for_account_type("cash") == "现金"
    assert BankAccountService.resolve_payment_method_for_account_type("CASH") == "现金"
    assert BankAccountService.resolve_payment_method_for_account_type(None) == "银行转账"


def test_build_voucher_bank_summary_prefers_notes():
    assert (
        build_voucher_bank_summary(
            voucher_kind="receipt",
            voucher_code="SK1",
            partner_name="甲",
            source_codes=["YS1", "YS2"],
            notes="  用户备注  ",
        )
        == "用户备注"
    )


def test_build_voucher_bank_summary_merge_receipt():
    assert (
        build_voucher_bank_summary(
            voucher_kind="receipt",
            voucher_code="SK202403190001",
            partner_name="上海客户",
            source_codes=["YS001", "YS002"],
        )
        == "合并收款 SK202403190001 上海客户 应收 YS001,YS002"
    )


def test_build_voucher_bank_summary_single_payment():
    assert (
        build_voucher_bank_summary(
            voucher_kind="payment",
            voucher_code="FK1",
            partner_name="供应商A",
            source_codes=["YF001"],
        )
        == "付款 FK1 供应商A 应付 YF001"
    )


def test_build_voucher_bank_summary_merge_payment():
    assert (
        build_voucher_bank_summary(
            voucher_kind="payment",
            voucher_code="FK202403190001",
            partner_name="深圳供应商",
            source_codes=["YF001", "YF002"],
        )
        == "合并付款 FK202403190001 深圳供应商 应付 YF001,YF002"
    )
