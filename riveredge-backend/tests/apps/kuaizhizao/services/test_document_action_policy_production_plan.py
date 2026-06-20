"""生产计划 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.production_plan import (
    assert_production_plan_capability,
    derive_production_plan_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _plan(**kwargs):
    defaults = {
        "status": "草稿",
        "execution_status": "未执行",
        "review_status": "待审核",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_pending_review_approve_and_withdraw():
    caps = derive_production_plan_capabilities(_plan(status="待审核"))
    assert caps.approve.allowed
    assert caps.withdraw_submit.allowed
    assert not caps.submit.allowed


def test_rejected_resubmit():
    caps = derive_production_plan_capabilities(_plan(status="已驳回"))
    assert caps.submit.allowed
    assert not caps.approve.allowed


def test_execute_requires_audit_when_enabled():
    caps = derive_production_plan_capabilities(
        _plan(status="草稿"),
        audit_required=True,
    )
    assert not caps.execute.allowed
    caps_ok = derive_production_plan_capabilities(
        _plan(status="已审核"),
        audit_required=True,
    )
    assert caps_ok.execute.allowed


def test_assert_execute_when_executed_raises():
    with pytest.raises(BusinessLogicError):
        assert_production_plan_capability(
            _plan(execution_status="已执行"),
            "execute",
        )
