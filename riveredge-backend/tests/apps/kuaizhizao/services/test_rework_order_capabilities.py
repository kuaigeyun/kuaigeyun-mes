"""返工单双路线与 capabilities 单元测试。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_action_policy.rework_order import (
    capability_kwargs_from_context,
    derive_rework_order_capabilities,
)
from apps.kuaizhizao.utils.rework_order_constants import (
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
