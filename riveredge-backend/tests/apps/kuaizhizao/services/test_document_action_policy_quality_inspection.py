"""质量管理检验单 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
    assert_quality_inspection_capability,
    can_conduct_quality_inspection,
    derive_quality_inspection_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _inspection(**kwargs):
    defaults = {
        "status": "待检验",
        "review_status": "待审核",
        "quality_status": "合格",
        "inspection_result": "待检验",
        "unqualified_quantity": 0,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_conduct_when_pending():
    caps = derive_quality_inspection_capabilities(_inspection())
    assert caps.conduct.allowed


def test_conduct_after_inspected_allows_reedit():
    caps = derive_quality_inspection_capabilities(_inspection(status="已检验", inspection_result="已检验"))
    assert caps.conduct.allowed


def test_conduct_after_revoke_approval():
    caps = derive_quality_inspection_capabilities(
        _inspection(status="已检验", review_status="待审核", inspection_result="合格"),
    )
    assert caps.conduct.allowed
    assert caps.update.allowed


def test_conduct_blocked_when_approved():
    caps = derive_quality_inspection_capabilities(
        _inspection(status="已审核", review_status="通过", inspection_result="已检验"),
    )
    assert not caps.conduct.allowed
    assert caps.conduct.reason == "quality_inspection.conduct.approved_locked"


def test_conduct_after_rejected():
    caps = derive_quality_inspection_capabilities(
        _inspection(status="已驳回", review_status="已驳回", inspection_result="不合格"),
    )
    assert caps.conduct.allowed


def test_can_conduct_helper():
    assert can_conduct_quality_inspection("待检验", "待检验")
    assert can_conduct_quality_inspection("已检验", "合格")
    assert not can_conduct_quality_inspection("已审核", "合格")


def test_create_defect_requires_inspected_unqualified():
    caps = derive_quality_inspection_capabilities(
        _inspection(status="已检验", quality_status="不合格", unqualified_quantity=2),
    )
    assert caps.create_defect.allowed

    caps_pending = derive_quality_inspection_capabilities(
        _inspection(status="待检验", quality_status="不合格", unqualified_quantity=2),
    )
    assert not caps_pending.create_defect.allowed


def test_approve_when_pending_review():
    caps = derive_quality_inspection_capabilities(
        _inspection(status="已检验", review_status="待审核"),
    )
    assert caps.approve.allowed


def test_revoke_when_approved():
    caps = derive_quality_inspection_capabilities(
        _inspection(status="已审核", review_status="通过", inspection_result="已检验"),
    )
    assert caps.revoke_approval.allowed
    assert not caps.approve.allowed


def test_revoke_denied_when_inspected_pending():
    caps = derive_quality_inspection_capabilities(
        _inspection(status="已检验", review_status="待审核", inspection_result="已检验"),
    )
    assert not caps.revoke_approval.allowed


def test_assert_conduct_raises():
    with pytest.raises(BusinessLogicError):
        assert_quality_inspection_capability(
            _inspection(status="已审核", inspection_result="已检验"),
            "conduct",
        )
