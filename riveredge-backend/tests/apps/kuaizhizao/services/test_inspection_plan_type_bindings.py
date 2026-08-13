"""质检方案类型与主数据绑定门禁。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.inspection_policy_service import (
    assert_stage_plan_types,
    format_incompatible_plan_type_change_message,
    incompatible_bindings_for_plan_type,
)
from infra.exceptions.exceptions import ValidationError


def test_incoming_plan_cannot_bind_to_ipqc():
    plans = {11: SimpleNamespace(plan_code="ZJFA001", plan_type="incoming")}
    with pytest.raises(ValidationError, match="不能绑定到过程检验"):
        assert_stage_plan_types([("ipqc", 11)], plans)


def test_process_plan_can_bind_to_ipqc():
    plans = {11: SimpleNamespace(plan_code="ZJFA001", plan_type="process")}
    assert_stage_plan_types([("ipqc", 11)], plans)


def test_finished_plan_cannot_bind_to_iqc():
    plans = {8: SimpleNamespace(plan_code="ZJFA002", plan_type="finished")}
    with pytest.raises(ValidationError, match="不能绑定到来料检验"):
        assert_stage_plan_types([("iqc", 8)], plans)


def test_missing_plan_raises():
    with pytest.raises(ValidationError, match="质检方案不存在"):
        assert_stage_plan_types([("ipqc", 99)], {})


def test_type_change_blocked_when_bound_to_operation():
    bindings = [
        {
            "kind": "operation",
            "code": "GX0001",
            "name": "加水",
            "stage": "ipqc",
            "expected_plan_type": "process",
        }
    ]
    incompatible = incompatible_bindings_for_plan_type(bindings, "finished")
    assert len(incompatible) == 1
    msg = format_incompatible_plan_type_change_message(
        "ZJFA202608110002", "process", "finished", incompatible
    )
    assert "GX0001" in msg
    assert "成品检验" in msg
    assert "过程检验" in msg


def test_type_change_allowed_when_new_type_matches_binding():
    bindings = [
        {
            "kind": "operation",
            "code": "GX0001",
            "name": "加水",
            "stage": "ipqc",
            "expected_plan_type": "process",
        }
    ]
    assert incompatible_bindings_for_plan_type(bindings, "process") == []
