"""出库 Hub document_action_policy：删除与审核门禁。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.warehouse_outbound_hub import (
    assert_outbound_hub_capability,
    derive_outbound_hub_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _r(**kwargs):
    defaults = {"status": "待出库", "review_status": "待审核"}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_sales_delivery_pending_audit_can_delete():
    caps = derive_outbound_hub_capabilities(
        _r(status="待审核", review_status="待审核"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    assert caps.delete.allowed
    assert not caps.confirm.allowed
    assert caps.confirm.reason == "outbound_hub.confirm.pending_audit"


def test_sales_delivery_audited_pending_outbound_cannot_delete():
    caps = derive_outbound_hub_capabilities(
        _r(status="待出库", review_status="已通过"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    assert not caps.delete.allowed
    assert caps.delete.reason == "outbound_hub.delete.audited"
    assert caps.confirm.allowed


def test_sales_delivery_no_audit_pending_outbound_can_delete():
    caps = derive_outbound_hub_capabilities(
        _r(status="待出库", review_status="已通过"),
        outbound_type="sales_delivery",
        audit_required=False,
    )
    assert caps.delete.allowed
    assert caps.confirm.allowed


def test_sales_delivery_posted_cannot_delete():
    caps = derive_outbound_hub_capabilities(
        _r(status="已出库", review_status="已通过"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    assert not caps.delete.allowed
    assert caps.delete.reason == "outbound_hub.delete.posted"
    assert caps.withdraw.allowed


def test_sales_delivery_draft_and_cancelled_can_delete():
    draft = derive_outbound_hub_capabilities(
        _r(status="草稿", review_status="已驳回"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    cancelled = derive_outbound_hub_capabilities(
        _r(status="已取消"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    assert draft.delete.allowed
    assert cancelled.delete.allowed


def test_production_picking_pending_audit_can_delete_audited_cannot():
    pending = derive_outbound_hub_capabilities(
        _r(status="待审核", review_status="待审核"),
        outbound_type="production_picking",
        audit_required=True,
    )
    audited = derive_outbound_hub_capabilities(
        _r(status="待领料", review_status="已通过"),
        outbound_type="production_picking",
        audit_required=True,
    )
    assert pending.delete.allowed
    assert not audited.delete.allowed
    assert audited.delete.reason == "outbound_hub.delete.audited"


def test_assert_delete_audited_raises():
    with pytest.raises(BusinessLogicError, match="已审核通过"):
        assert_outbound_hub_capability(
            _r(status="待出库", review_status="已通过"),
            "delete",
            outbound_type="sales_delivery",
            audit_required=True,
        )


def test_outsource_issue_cannot_delete():
    caps = derive_outbound_hub_capabilities(
        _r(status="已出库"),
        outbound_type="outsource_issue",
        audit_required=False,
    )
    assert not caps.delete.allowed
    assert caps.delete.reason == "outbound_hub.delete.outsource_issue"


def test_sales_delivery_pending_outbound_can_update():
    caps = derive_outbound_hub_capabilities(
        _r(status="待出库", review_status="已通过"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    assert caps.update.allowed
    assert caps.confirm.allowed


def test_sales_delivery_pending_audit_can_update():
    caps = derive_outbound_hub_capabilities(
        _r(status="待审核", review_status="待审核"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    assert caps.update.allowed
    assert not caps.confirm.allowed


def test_sales_delivery_posted_cannot_update():
    caps = derive_outbound_hub_capabilities(
        _r(status="已出库", review_status="已通过"),
        outbound_type="sales_delivery",
        audit_required=True,
    )
    assert not caps.update.allowed
    assert caps.update.reason == "outbound_hub.update.posted"
    assert caps.withdraw.allowed


def test_other_outbound_pending_can_update():
    caps = derive_outbound_hub_capabilities(
        _r(status="待出库"),
        outbound_type="other_outbound",
        audit_required=False,
    )
    assert caps.update.allowed
