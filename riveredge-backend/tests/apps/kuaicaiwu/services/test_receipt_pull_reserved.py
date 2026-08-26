"""收款加载门控：草稿收款单不占用应收可加载额度。"""

from decimal import Decimal

from apps.kuaicaiwu.services.receipt_pull_service import ReceiptPullService


class _FakeReceivable:
    id = 1
    receivable_code = "YS202608250002"
    customer_name = "老李头"
    total_amount = Decimal("1000")
    received_amount = Decimal("0")
    remaining_amount = Decimal("1000")


def test_build_preview_item_full_remaining_when_no_confirmed_reserved():
    svc = ReceiptPullService()
    item = svc._build_preview_item(
        receivable=_FakeReceivable(),
        reserved_unsettled=Decimal("0"),
    )
    assert item["max_push_quantity"] == 1000.0


def test_build_preview_item_zero_when_confirmed_receipt_reserved_full_amount():
    svc = ReceiptPullService()
    item = svc._build_preview_item(
        receivable=_FakeReceivable(),
        reserved_unsettled=Decimal("1000"),
    )
    assert item["max_push_quantity"] == 0.0


def test_reserved_receipt_statuses_exclude_draft():
    svc = ReceiptPullService()
    assert "Confirmed" in svc._RESERVED_RECEIPT_STATUSES
    assert "Draft" not in svc._RESERVED_RECEIPT_STATUSES
