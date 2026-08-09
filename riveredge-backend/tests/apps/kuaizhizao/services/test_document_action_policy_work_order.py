"""工单 document_action_policy 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.work_order import (
    assert_work_order_capability,
    derive_work_order_capabilities,
)
from infra.exceptions.exceptions import BusinessLogicError


def _wo(**kwargs):
    defaults = {
        "row_kind": "work_order",
        "status": "draft",
        "is_frozen": False,
        "manually_completed": False,
        "actual_start_date": None,
        "completed_quantity": 0,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_draft_release_and_update():
    caps = derive_work_order_capabilities(_wo())
    assert caps.release.allowed
    assert caps.update.allowed
    assert caps.freeze.allowed
    assert not caps.revoke.allowed


def test_frozen_blocks_release():
    caps = derive_work_order_capabilities(_wo(is_frozen=True))
    assert not caps.release.allowed
    assert caps.unfreeze.allowed


def test_cancelled_terminal():
    caps = derive_work_order_capabilities(_wo(status="cancelled"))
    assert not caps.cancel.allowed
    assert caps.delete.allowed


def test_non_work_order_row_denied():
    caps = derive_work_order_capabilities(_wo(row_kind="group"))
    assert not caps.release.allowed
    assert not caps.print.allowed
    assert not caps.revoke.allowed


def test_assert_release_on_completed_raises():
    with pytest.raises(BusinessLogicError):
        assert_work_order_capability(_wo(status="completed"), "release")


def test_released_can_revoke_without_downstream():
    caps = derive_work_order_capabilities(_wo(status="released"), has_downstream_documents=False)
    assert caps.revoke.allowed


def test_released_cannot_revoke_with_downstream():
    caps = derive_work_order_capabilities(_wo(status="released"), has_downstream_documents=True)
    assert not caps.revoke.allowed
    assert caps.revoke.reason == "work_order.revoke.has_downstream"


def test_in_progress_cannot_revoke_with_work():
    caps = derive_work_order_capabilities(
        _wo(status="in_progress", completed_quantity=1),
        has_downstream_documents=False,
    )
    assert not caps.revoke.allowed
    assert caps.revoke.reason == "work_order.revoke.has_work"


def test_completed_manual_can_revoke_without_downstream():
    caps = derive_work_order_capabilities(
        _wo(status="completed", manually_completed=True),
        has_downstream_documents=False,
    )
    assert caps.revoke.allowed


def test_completed_normal_cannot_revoke():
    caps = derive_work_order_capabilities(_wo(status="completed", manually_completed=False))
    assert not caps.revoke.allowed


def test_assert_revoke_blocked_by_downstream():
    with pytest.raises(BusinessLogicError, match="下游单据"):
        assert_work_order_capability(
            _wo(status="released"),
            "revoke",
            has_downstream_documents=True,
        )
