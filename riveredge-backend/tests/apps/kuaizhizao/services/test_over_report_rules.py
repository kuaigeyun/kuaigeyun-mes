from decimal import Decimal

from apps.kuaizhizao.services.over_report_rules import (
    OVER_REPORT_NONE,
    max_completed_quantity_for_plan,
    remaining_completed_headroom,
)


def test_max_completed_none_is_plan_only():
    assert max_completed_quantity_for_plan(Decimal("200"), OVER_REPORT_NONE, Decimal("0")) == Decimal(
        "200"
    )


def test_max_completed_fixed_adds_extra():
    cap = max_completed_quantity_for_plan(Decimal("200"), "fixed", Decimal("10"))
    assert cap == Decimal("210")


def test_remaining_headroom_blocks_makeup_bypass():
    """不允许超报时：已报满计划后不可再借「合格缺口补报」突破累计完成上限。"""
    headroom = remaining_completed_headroom(
        Decimal("200"),
        Decimal("200"),
        OVER_REPORT_NONE,
        Decimal("0"),
    )
    assert headroom == Decimal("0")


def test_remaining_headroom_allows_up_to_cap():
    headroom = remaining_completed_headroom(
        Decimal("200"),
        Decimal("150"),
        OVER_REPORT_NONE,
        Decimal("0"),
    )
    assert headroom == Decimal("50")
