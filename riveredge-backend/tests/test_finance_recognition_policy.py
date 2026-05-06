"""财务收入/应付确认策略：参数互斥与合并逻辑单测。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from infra.services.business_config_service import BusinessConfigService, coerce_finance_parameter_dict


def test_coerce_finance_on_shipment_clears_invoice_auto_ar():
    fin = coerce_finance_parameter_dict(
        {
            "revenue_recognition": "on_shipment",
            "auto_generate_receivable_from_sales_invoice": True,
        }
    )
    assert fin["revenue_recognition"] == "on_shipment"
    assert fin["auto_generate_receivable_from_sales_invoice"] is False


def test_coerce_finance_on_invoice_keeps_invoice_auto_ar_flag():
    fin = coerce_finance_parameter_dict(
        {
            "revenue_recognition": "on_invoice",
            "auto_generate_receivable_from_sales_invoice": True,
        }
    )
    assert fin["revenue_recognition"] == "on_invoice"
    assert fin["auto_generate_receivable_from_sales_invoice"] is True


def test_coerce_finance_on_receipt_clears_purchase_invoice_auto_ap():
    fin = coerce_finance_parameter_dict(
        {
            "payable_recognition": "on_receipt",
            "auto_generate_payable_from_purchase_invoice": True,
        }
    )
    assert fin["payable_recognition"] == "on_receipt"
    assert fin["auto_generate_payable_from_purchase_invoice"] is False


def test_coerce_finance_invalid_recognition_defaults():
    fin = coerce_finance_parameter_dict({"revenue_recognition": "invalid", "payable_recognition": "nope"})
    assert fin["revenue_recognition"] == "on_shipment"
    assert fin["payable_recognition"] == "on_receipt"


@pytest.mark.asyncio
async def test_resolve_revenue_recognition_customer_override():
    svc = BusinessConfigService()
    svc.get_business_config = AsyncMock(
        return_value={"parameters": {"finance": {"revenue_recognition": "on_shipment"}}}
    )
    cust = MagicMock()
    cust.revenue_recognition_override = "on_invoice"
    with patch(
        "infra.services.business_config_service.Customer.get_or_none",
        new_callable=AsyncMock,
        return_value=cust,
    ):
        assert await svc.resolve_revenue_recognition(1, 99) == "on_invoice"


@pytest.mark.asyncio
async def test_should_invoice_ar_when_org_shipment_but_customer_on_invoice():
    """组织按发货时，客户覆盖为按票则解析为 on_invoice，且可绕过被互斥清零的开票自动应收开关。"""
    svc = BusinessConfigService()
    svc.get_business_config = AsyncMock(
        return_value={
            "parameters": {
                "finance": {
                    "revenue_recognition": "on_shipment",
                    "auto_generate_receivable_from_sales_invoice": False,
                }
            }
        }
    )
    cust = MagicMock()
    cust.revenue_recognition_override = "on_invoice"
    with patch(
        "infra.services.business_config_service.Customer.get_or_none",
        new_callable=AsyncMock,
        return_value=cust,
    ):
        assert await svc.should_auto_generate_receivable_from_sales_invoice_effective(1, 10) is True


@pytest.mark.asyncio
async def test_should_not_invoice_ar_when_org_shipment_without_override():
    svc = BusinessConfigService()
    svc.get_business_config = AsyncMock(
        return_value={
            "parameters": {
                "finance": {
                    "revenue_recognition": "on_shipment",
                    "auto_generate_receivable_from_sales_invoice": False,
                }
            }
        }
    )
    cust = MagicMock()
    cust.revenue_recognition_override = None
    with patch(
        "infra.services.business_config_service.Customer.get_or_none",
        new_callable=AsyncMock,
        return_value=cust,
    ):
        assert await svc.should_auto_generate_receivable_from_sales_invoice_effective(1, 10) is False


@pytest.mark.asyncio
async def test_should_invoice_ar_org_on_invoice_requires_master_switch():
    svc = BusinessConfigService()
    svc.get_business_config = AsyncMock(
        return_value={
            "parameters": {
                "finance": {
                    "revenue_recognition": "on_invoice",
                    "auto_generate_receivable_from_sales_invoice": False,
                }
            }
        }
    )
    with patch(
        "infra.services.business_config_service.Customer.get_or_none",
        new_callable=AsyncMock,
        return_value=None,
    ):
        assert await svc.should_auto_generate_receivable_from_sales_invoice_effective(1, None) is False


@pytest.mark.asyncio
async def test_should_payable_invoice_when_org_receipt_but_supplier_on_purchase_invoice():
    svc = BusinessConfigService()
    svc.get_business_config = AsyncMock(
        return_value={
            "parameters": {
                "finance": {
                    "payable_recognition": "on_receipt",
                    "auto_generate_payable_from_purchase_invoice": False,
                }
            }
        }
    )
    sup = MagicMock()
    sup.payable_recognition_override = "on_purchase_invoice"
    with patch(
        "infra.services.business_config_service.Supplier.get_or_none",
        new_callable=AsyncMock,
        return_value=sup,
    ):
        assert await svc.should_auto_generate_payable_from_purchase_invoice_effective(1, 20) is True
