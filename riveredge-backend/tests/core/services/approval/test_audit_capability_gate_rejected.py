"""驳回相位与 capabilities 裁剪。"""

from core.services.approval.audit_capability_gate import gate_audit_allowed_actions


def test_rejected_phase_keeps_submit_even_when_capability_submit_false():
    audit = {"phase": "rejected", "allowed_actions": ["submit"]}
    caps = {"submit": {"allowed": False}}
    out = gate_audit_allowed_actions(audit, caps)
    assert out is not None
    assert out["allowed_actions"] == ["submit"]


def test_draft_phase_still_gates_submit_by_capability():
    audit = {"phase": "draft", "allowed_actions": ["submit"]}
    caps = {"submit": {"allowed": False}}
    out = gate_audit_allowed_actions(audit, caps)
    assert out is not None
    assert out["allowed_actions"] == []
