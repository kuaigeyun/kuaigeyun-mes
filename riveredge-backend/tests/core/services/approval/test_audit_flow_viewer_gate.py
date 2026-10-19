"""audit_flow_viewer_gate 与列表 viewer_actions 裁剪。"""

from core.services.approval.audit_flow_viewer_gate import (
    apply_viewer_actions_to_audit_and_capabilities,
)


def test_apply_viewer_actions_keeps_allowed_actions_and_gates_capabilities():
    audit = {
        "phase": "pending",
        "enabled": True,
        "allowed_actions": ["approve", "reject", "withdraw"],
    }
    caps = {
        "approve": {"allowed": True, "reason": None},
        "reject": {"allowed": True, "reason": None},
        "withdraw_submit": {"allowed": True, "reason": None},
    }
    viewer_actions = {
        "approve": False,
        "reject": False,
        "block_reason": "当前节点待办人：杨志伟",
    }
    gated_audit, gated_caps = apply_viewer_actions_to_audit_and_capabilities(
        audit, caps, viewer_actions
    )
    assert gated_audit is not None
    assert set(gated_audit["allowed_actions"]) == {"approve", "reject", "withdraw"}
    assert gated_audit["viewer_actions"] == viewer_actions
    assert gated_caps["approve"]["allowed"] is False
    assert gated_caps["approve"]["reason"] == "当前节点待办人：杨志伟"
    assert gated_caps["reject"]["allowed"] is False
    assert gated_caps["withdraw_submit"]["allowed"] is True
