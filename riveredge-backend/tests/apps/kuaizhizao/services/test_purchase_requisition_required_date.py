"""Tests for purchase requisition → purchase order required date resolution."""

from datetime import date
from types import SimpleNamespace

from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService


def _item(required_date=None):
    return SimpleNamespace(required_date=required_date)


def test_resolve_requisition_item_required_date_prefers_line():
    item = _item(date(2026, 8, 18))
    resolved = PurchaseRequisitionService._resolve_requisition_item_required_date(
        item,
        date(2026, 4, 3),
        date(2026, 4, 2),
    )
    assert resolved == date(2026, 8, 18)


def test_resolve_requisition_item_required_date_falls_back_to_header():
    item = _item(None)
    resolved = PurchaseRequisitionService._resolve_requisition_item_required_date(
        item,
        date(2026, 8, 18),
        date(2026, 4, 2),
    )
    assert resolved == date(2026, 8, 18)


def test_resolve_requisition_item_required_date_falls_back_to_today():
    item = _item(None)
    resolved = PurchaseRequisitionService._resolve_requisition_item_required_date(
        item,
        None,
        date(2026, 4, 2),
    )
    assert resolved == date(2026, 4, 2)
