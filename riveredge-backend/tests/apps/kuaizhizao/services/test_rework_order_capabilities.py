"""返工单双路线与 capabilities 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.rework_order import (
    capability_kwargs_from_context,
    derive_rework_order_capabilities,
)
from apps.kuaizhizao.services.rework_order_workflow import resolve_awaiting_route_decision
from apps.kuaizhizao.utils.rework_order_constants import (
    OPERATION_STATUS_ACTIVE,
    OPERATION_STATUS_COMPLETED,
    OPERATION_STATUS_PENDING,
    ROUTING_MODE_DYNAMIC,
    ROUTING_MODE_PREDEFINED,
)


def _record(**kwargs):
    return SimpleNamespace(**kwargs)


def test_capability_kwargs_from_context_ignores_non_policy_keys():
    ctx = {
        "has_reports": True,
        "current_op_completed": False,
        "has_completed_operation": True,
        "awaiting_route_decision": False,
        "verification_passed": False,
        "links": [object()],
        "current_link": object(),
    }
    assert capability_kwargs_from_context(ctx) == {
        "has_reports": True,
        "current_op_completed": False,
        "has_completed_operation": True,
        "awaiting_route_decision": False,
        "verification_passed": False,
    }


def test_release_allowed_only_in_draft():
    caps = derive_rework_order_capabilities(_record(status="draft"))
    assert caps.release.allowed is True
    caps_released = derive_rework_order_capabilities(_record(status="released"))
    assert caps_released.release.allowed is False


def test_dynamic_advance_when_awaiting_decision():
    caps = derive_rework_order_capabilities(
        _record(status="in_progress", routing_mode=ROUTING_MODE_DYNAMIC),
        awaiting_route_decision=True,
        has_completed_operation=True,
    )
    assert caps.advance_next.allowed is True
    assert caps.execute.allowed is False


def test_awaiting_route_decision_after_current_link_cleared():
    """动态路线首道报满后清空 current_link，仍应判定为待决策（二次返工常见卡死点）。"""
    completed = _record(status=OPERATION_STATUS_COMPLETED)
    assert resolve_awaiting_route_decision(
        status="in_progress",
        routing_mode=ROUTING_MODE_DYNAMIC,
        links=[completed],
        current_link=None,
    ) is True


def test_not_awaiting_when_active_link_exists():
    active = _record(status=OPERATION_STATUS_ACTIVE)
    pending = _record(status=OPERATION_STATUS_PENDING)
    assert resolve_awaiting_route_decision(
        status="in_progress",
        routing_mode=ROUTING_MODE_DYNAMIC,
        links=[active, pending],
        current_link=active,
    ) is False


def test_not_awaiting_for_predefined_route():
    completed = _record(status=OPERATION_STATUS_COMPLETED)
    assert resolve_awaiting_route_decision(
        status="in_progress",
        routing_mode=ROUTING_MODE_PREDEFINED,
        links=[completed],
        current_link=None,
    ) is False


def test_predefined_no_advance_next():
    caps = derive_rework_order_capabilities(
        _record(status="in_progress", routing_mode=ROUTING_MODE_PREDEFINED),
        awaiting_route_decision=True,
        has_completed_operation=True,
    )
    assert caps.advance_next.allowed is False


def test_close_from_quality_released():
    caps = derive_rework_order_capabilities(_record(status="quality_released"))
    assert caps.close.allowed is True


def test_request_complete_requires_completed_operation():
    caps = derive_rework_order_capabilities(
        _record(status="in_progress", routing_mode=ROUTING_MODE_DYNAMIC),
        has_completed_operation=False,
    )
    assert caps.request_complete.allowed is False
