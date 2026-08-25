from decimal import Decimal

from apps.kuaizhizao.services.purchase_service import PurchaseService


def test_apply_purchase_item_price_settlement_overwrites_null_status():
    item_dict = {"price_settlement_status": None, "provisional_unit_price": None}

    PurchaseService._apply_purchase_item_price_settlement(
        item_dict,
        unit_price=Decimal("0.2655"),
        partner_settlement_method=None,
        explicit_status=None,
        explicit_provisional_price=None,
    )

    assert item_dict["price_settlement_status"] == "SETTLED"
    assert item_dict["provisional_unit_price"] is None


def test_apply_purchase_item_price_settlement_monthly_zero_price():
    item_dict = {"price_settlement_status": None}

    PurchaseService._apply_purchase_item_price_settlement(
        item_dict,
        unit_price=Decimal("0"),
        partner_settlement_method="monthly",
        explicit_status=None,
        explicit_provisional_price=Decimal("0.25"),
    )

    assert item_dict["price_settlement_status"] == "PROVISIONAL"
    assert item_dict["provisional_unit_price"] == Decimal("0.25")
