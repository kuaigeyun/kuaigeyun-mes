"""audit_transition 单元测试。"""

from __future__ import annotations

from core.services.approval.audit_transition import resolve_revoke_landing_phase


def test_revoke_lands_pending_when_manual_audit():
    assert resolve_revoke_landing_phase(manual_audit_enabled=True) == "pending"


def test_revoke_lands_draft_when_auto_audit():
    assert resolve_revoke_landing_phase(manual_audit_enabled=False) == "draft"


def test_sales_order_revoke_state_pending():
    from core.services.approval.audit_transition import resolve_sales_order_revoke_state

    state = resolve_sales_order_revoke_state(landing="pending")
    assert state == {"status": "PENDING_REVIEW", "review_status": "PENDING"}


def test_sales_order_revoke_state_draft():
    from core.services.approval.audit_transition import resolve_sales_order_revoke_state

    state = resolve_sales_order_revoke_state(landing="draft")
    assert state == {"status": "DRAFT", "review_status": "PENDING"}
