"""Wave 2 告警阈值与填充单元测试。"""

from decimal import Decimal

from apps.kuaiiot.services.alert_threshold_resolver import format_actual_value, is_threshold_breached
from apps.kuaiiot.services.tag_service import TagService


class TestAlertThresholdResolver:
    def test_numeric_gt(self):
        assert is_threshold_breached(
            "gt",
            threshold_number=Decimal("80"),
            threshold_text=None,
            value_number=Decimal("85"),
            value_text=None,
            value_bool=None,
        )

    def test_numeric_not_breached(self):
        assert not is_threshold_breached(
            "gt",
            threshold_number=Decimal("80"),
            threshold_text=None,
            value_number=Decimal("70"),
            value_text=None,
            value_bool=None,
        )

    def test_text_eq(self):
        assert is_threshold_breached(
            "eq",
            threshold_number=None,
            threshold_text="fault",
            value_text="fault",
            value_number=None,
            value_bool=None,
        )

    def test_format_actual_value(self):
        assert format_actual_value(None, Decimal("12.5"), None) == "12.5"
        assert format_actual_value(None, None, True) == "true"


def test_fill_target_validation():
    TagService._validate_fill_target("sop_parameters.temp")
    TagService._validate_fill_target("spot_check.pressure")
    TagService._validate_fill_target(None)
