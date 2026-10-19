"""终审撤销重开：动作归一化与落点契约。"""

from __future__ import annotations

from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.services.approval.audit_transition import resolve_revoke_to_draft_landing_phase


def test_normalize_revoke_action():
    assert ApprovalInstanceService._normalize_execution_action("revoke") == "revoke"
    assert ApprovalInstanceService._normalize_execution_action("unapprove") == "revoke"
    assert ApprovalInstanceService._execution_action_label("revoke") == "撤销审核"


def test_landing_pending_only_when_manual_and_reopened():
    assert (
        resolve_revoke_to_draft_landing_phase(
            manual_audit_enabled=True, flow_reopened=True
        )
        == "pending"
    )
    assert (
        resolve_revoke_to_draft_landing_phase(
            manual_audit_enabled=True, flow_reopened=False
        )
        == "draft"
    )
