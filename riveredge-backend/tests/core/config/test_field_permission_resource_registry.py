"""field_permission_resource_registry 单元测试。"""

from core.config.field_permission_resource_registry import (
    field_names_for_resource,
    is_valid_field_policy,
)


def test_unregistered_resource_has_no_fields():
    assert field_names_for_resource("system:user-message") == frozenset()
    assert not is_valid_field_policy("system:user-preference", "amount")


def test_sales_order_has_amount_and_customer():
    fields = field_names_for_resource("kuaizhizao:sales-order")
    assert "total_amount" in fields
    assert "customer_name" in fields


def test_purchase_order_has_no_customer():
    fields = field_names_for_resource("kuaizhizao:purchase-order")
    assert "total_amount" in fields
    assert "customer_name" not in fields


def test_outsource_order_subset():
    fields = field_names_for_resource("kuaizhizao:outsource-order")
    assert fields == frozenset({"unit_price", "total_amount", "amount"})
