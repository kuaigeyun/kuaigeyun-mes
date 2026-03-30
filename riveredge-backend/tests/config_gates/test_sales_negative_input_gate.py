import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import ValidationError
from apps.kuaizhizao.services.sales_order_service import SalesOrderService
from apps.kuaizhizao.services.quotation_service import QuotationService


@pytest.mark.unit
def test_sales_order_item_should_block_negative_quantity():
    with pytest.raises(ValidationError, match="数量必须大于0"):
        SalesOrderService._validate_sales_item_non_negative(
            required_quantity=Decimal("-1"),
            unit_price=Decimal("1"),
            tax_rate=Decimal("13"),
            item_amount=Decimal("1"),
        )


@pytest.mark.unit
def test_sales_order_item_should_block_negative_unit_price():
    with pytest.raises(ValidationError, match="单价不能为负数"):
        SalesOrderService._validate_sales_item_non_negative(
            required_quantity=Decimal("1"),
            unit_price=Decimal("-0.01"),
            tax_rate=Decimal("13"),
            item_amount=Decimal("1"),
        )


@pytest.mark.unit
def test_sales_order_should_block_negative_discount():
    with pytest.raises(ValidationError, match="优惠金额不能为负数"):
        SalesOrderService._validate_sales_order_non_negative(
            discount_amount=Decimal("-0.01"),
            total_quantity=Decimal("1"),
            total_amount=Decimal("100"),
            total_fee_amount=Decimal("0"),
        )


@pytest.mark.unit
def test_quotation_item_should_block_negative_total_amount():
    with pytest.raises(ValidationError, match="金额不能为负数"):
        QuotationService._validate_quotation_item_non_negative(
            quote_quantity=Decimal("1"),
            unit_price=Decimal("10"),
            total_amount=Decimal("-1"),
        )


@pytest.mark.unit
def test_quotation_should_block_negative_total_amount():
    with pytest.raises(ValidationError, match="总金额不能为负数"):
        QuotationService._validate_quotation_non_negative(
            total_quantity=Decimal("1"),
            total_amount=Decimal("-1"),
        )
