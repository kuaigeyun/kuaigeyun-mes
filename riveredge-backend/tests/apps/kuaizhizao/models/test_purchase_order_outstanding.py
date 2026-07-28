from decimal import Decimal
from types import SimpleNamespace

import pytest

from apps.kuaizhizao.models.purchase_order import effective_po_item_outstanding
from apps.kuaizhizao.services.warehouse_service import _validate_purchase_receipt_tolerance
from infra.exceptions.exceptions import BusinessLogicError


def _po_item(**kwargs):
    defaults = {
        "ordered_quantity": Decimal("32400"),
        "received_quantity": Decimal("32400"),
        "outstanding_quantity": Decimal("32400"),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_effective_po_item_outstanding_caps_stale_stored_by_ordered_minus_received():
    item = _po_item()
    assert effective_po_item_outstanding(item) == Decimal("0")


def test_effective_po_item_outstanding_uses_stored_when_not_above_computed():
    item = _po_item(received_quantity=Decimal("0"), outstanding_quantity=Decimal("100"))
    assert effective_po_item_outstanding(item) == Decimal("100")


def test_validate_purchase_receipt_tolerance_reports_confirmed_and_pending_parts():
    with pytest.raises(BusinessLogicError) as exc:
        _validate_purchase_receipt_tolerance(
            ordered_quantity=Decimal("32400"),
            already_received_quantity=Decimal("32400"),
            incoming_quantity=Decimal("32400"),
            tolerance_percentage=0.0,
            material_label="山里红",
            confirmed_quantity=Decimal("32400"),
            pending_other_quantity=Decimal("0"),
        )
    message = str(exc.value)
    assert "64800" in message
    assert "已确认入库 32400" in message
    assert "本次入库 32400" in message
