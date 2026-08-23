"""采购订单下推状态门禁与 ORDER_PUSHABLE_STATUSES 对齐。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.document_action_policy.purchase_order import (
    derive_purchase_order_capabilities,
)


def test_in_progress_order_can_push_receipt_notice_when_qty_remains():
    order = SimpleNamespace(status="IN_PROGRESS", review_status="APPROVED")
    caps = derive_purchase_order_capabilities(
        order,
        has_items=True,
        has_outstanding=True,
        has_pushable_notice_outstanding=True,
    )
    assert caps.push_receipt_notice.allowed is True


def test_draft_order_cannot_push_receipt_notice():
    order = SimpleNamespace(status="DRAFT", review_status="PENDING")
    caps = derive_purchase_order_capabilities(
        order,
        has_items=True,
        has_outstanding=True,
        has_pushable_notice_outstanding=True,
    )
    assert caps.push_receipt_notice.allowed is False
