"""Tests for kuaizhizao logistics management."""

import pytest

from apps.kuaizhizao.services.freight_order_service import FREIGHT_STATUS_FLOW


@pytest.mark.parametrize(
    "current,target,allowed",
    [
        ("draft", "scheduled", True),
        ("draft", "signed", False),
        ("arrived", "signed", True),
        ("signed", "cancelled", False),
    ],
)
def test_freight_status_flow(current, target, allowed):
    assert (target in FREIGHT_STATUS_FLOW.get(current, set())) is allowed
