"""audit_phase 与 audit_capability_gate 单元测试。"""

from __future__ import annotations

from types import SimpleNamespace

from core.services.approval.audit_capability_gate import gate_audit_allowed_actions
from core.services.approval.audit_phase import derive_audit_phase


def test_sales_order_confirmed_approved_allows_revoke_manual():
    audit = derive_audit_phase(
        "sales_order",
        "CONFIRMED",
        "APPROVED",
        enabled=True,
    )
    assert audit["phase"] == "approved"
    assert "revoke" in audit["allowed_actions"]


def test_sales_order_confirmed_approved_allows_revoke_auto():
    audit = derive_audit_phase(
        "sales_order",
        "已生效",
        "已通过",
        enabled=False,
    )
    assert audit["mode"] == "auto"
    assert "revoke" in audit["allowed_actions"]


def test_quotation_accepted_denies_revoke():
    audit = derive_audit_phase(
        "quotation",
        "已接受",
        "审核通过",
        enabled=True,
    )
    assert "revoke" not in audit["allowed_actions"]


def test_gate_audit_strips_revoke_when_capability_denies():
    audit = {"phase": "approved", "allowed_actions": ["revoke"]}
    caps = SimpleNamespace(revoke_approval=SimpleNamespace(allowed=False))
    gated = gate_audit_allowed_actions(audit, caps)
    assert gated is not None
    assert gated["allowed_actions"] == []


def test_gate_audit_keeps_revoke_when_capability_allows():
    audit = {"phase": "approved", "allowed_actions": ["revoke"]}
    caps = SimpleNamespace(revoke_approval=SimpleNamespace(allowed=True))
    gated = gate_audit_allowed_actions(audit, caps)
    assert gated is not None
    assert gated["allowed_actions"] == ["revoke"]


def test_sales_return_pending_review_from_review_status():
    audit = derive_audit_phase("sales_return", "待退货", "待审核", enabled=True)
    assert audit["phase"] == "pending"


def test_sales_return_approved_review():
    audit = derive_audit_phase("sales_return", "已退货", "审核通过", enabled=True)
    assert audit["phase"] == "approved"


def test_sales_return_draft_review_from_review_status():
    audit = derive_audit_phase("sales_return", "待退货", "草稿", enabled=True)
    assert audit["phase"] == "draft"
    assert "submit" in audit["allowed_actions"]


def test_quality_inspection_pre_conduct_ignores_preset_approved():
    """未检验时即使 review=APPROVED（历史预置），审核列应为 none。"""
    for entity in (
        "incoming_inspection",
        "process_inspection",
        "finished_goods_inspection",
        "oqc_inspection",
    ):
        audit = derive_audit_phase(entity, "待检验", "APPROVED", enabled=False)
        assert audit["phase"] == "none", entity


def test_quality_inspection_pending_after_conduct():
    audit = derive_audit_phase(
        "incoming_inspection", "已检验", "PENDING", enabled=True
    )
    assert audit["phase"] == "pending"
    assert set(audit["allowed_actions"]) == {"approve", "reject"}


def test_quality_inspection_approved_after_auto_or_manual():
    audit = derive_audit_phase(
        "oqc_inspection", "已审核", "APPROVED", enabled=False
    )
    assert audit["phase"] == "approved"
    assert audit["allowed_actions"] == ["revoke"]

    manual = derive_audit_phase(
        "incoming_inspection", "已审核", "通过", enabled=True
    )
    assert manual["phase"] == "approved"
    assert manual["allowed_actions"] == ["revoke"]


def test_quality_inspection_auto_pending_has_no_submit_withdraw():
    """检验单无草稿提交态；关审时 pending 不得注入 submit/withdraw。"""
    audit = derive_audit_phase(
        "incoming_inspection", "已检验", "PENDING", enabled=False
    )
    assert audit["phase"] == "pending"
    assert audit["allowed_actions"] == []
