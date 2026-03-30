import inspect
import sys
import types

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.api.finance import invoices, payables, payments, purchase_invoices, receipts, receivables, sales_invoices
from apps.kuaicaiwu.api import finance_settlement


def _assert_has_auth_dependency(func):
    signature = inspect.signature(func)
    assert "_auth" in signature.parameters, f"{func.__name__} 缺少 _auth 权限依赖"


@pytest.mark.unit
def test_receivable_and_payable_routes_are_guarded():
    guarded = [
        receivables.create_receivable,
        receivables.list_receivables,
        receivables.get_receivable,
        receivables.record_receipt,
        receivables.approve_receivable,
        receivables.delete_receivable,
        payables.create_payable,
        payables.list_payables,
        payables.get_payable,
        payables.record_payment,
        payables.approve_payable,
        payables.delete_payable,
    ]
    for func in guarded:
        _assert_has_auth_dependency(func)


@pytest.mark.unit
def test_invoice_routes_are_guarded():
    guarded = [
        invoices.create_invoice,
        invoices.list_invoices,
        invoices.get_invoice,
        invoices.update_invoice,
        invoices.delete_invoice,
        purchase_invoices.create_purchase_invoice,
        purchase_invoices.list_purchase_invoices,
        purchase_invoices.get_purchase_invoice,
        purchase_invoices.approve_purchase_invoice,
        sales_invoices.create_sales_invoice,
        sales_invoices.list_sales_invoices,
        sales_invoices.get_sales_invoice,
        sales_invoices.update_sales_invoice,
        sales_invoices.approve_sales_invoice,
        sales_invoices.delete_sales_invoice,
    ]
    for func in guarded:
        _assert_has_auth_dependency(func)


@pytest.mark.unit
def test_payment_receipt_and_settlement_routes_are_guarded():
    guarded = [
        payments.create_payment,
        payments.list_payments,
        payments.get_payment,
        payments.update_payment,
        payments.confirm_payment,
        payments.cancel_payment,
        payments.delete_payment,
        receipts.create_receipt,
        receipts.list_receipts,
        receipts.get_receipt,
        receipts.update_receipt,
        receipts.confirm_receipt,
        receipts.cancel_receipt,
        receipts.delete_receipt,
        finance_settlement.get_receivable_suggestions,
        finance_settlement.get_payable_suggestions,
        finance_settlement.settle_receivable,
        finance_settlement.settle_payable,
        finance_settlement.auto_settle_receivables,
        finance_settlement.revaluate_period_end,
        finance_settlement.get_statement,
        finance_settlement.archive_statement,
    ]
    for func in guarded:
        _assert_has_auth_dependency(func)
