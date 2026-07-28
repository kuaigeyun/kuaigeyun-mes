"""OQC 出货检验 document_action_policy 单元测试。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.document_action_policy.oqc_inspection import (
    derive_oqc_inspection_capabilities,
)


def _inspection(**kwargs):
    defaults = {
        "status": "待检验",
        "review_status": "",
        "inspection_result": "待检验",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_oqc_conduct_when_pending():
    caps = derive_oqc_inspection_capabilities(_inspection())
    assert caps.conduct.allowed


def test_oqc_conduct_after_revoke():
    caps = derive_oqc_inspection_capabilities(
        _inspection(status="已检验", review_status="待审核", inspection_result="合格"),
    )
    assert caps.conduct.allowed


def test_oqc_conduct_blocked_when_approved():
    caps = derive_oqc_inspection_capabilities(
        _inspection(status="已审核", review_status="已审核", inspection_result="合格"),
    )
    assert not caps.conduct.allowed
    assert caps.conduct.reason == "oqc_inspection.conduct.approved_locked"
