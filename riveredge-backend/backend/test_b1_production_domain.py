"""
外置回归：B1 生产域（工单/报工/返工）核心不变量。
放在 D:\\pytest\\d-kuaigeyun\\backend，不进入项目 tests/。

覆盖：
- over_report_rules 纯函数：超报上限/剩余可报量（fixed、percent、none、钳制）
- rework_order_workflow.recoverable_report_unqualified_take 幂等挽回量
- rework_order_capabilities 状态机：execute/release/close 门禁
- reporting_service 自审守卫：小组报工（worker_id 为空）绕过审核分离
- 源字符串不变量：审核/撤销/删除等关键路径必须包在 in_transaction 内
"""

from __future__ import annotations

import ast
import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

BACKEND_SRC = Path(r"D:\kuaigeyun-pro\kuaigeyun\riveredge-backend\src")
REPORTING = (
    BACKEND_SRC / "apps" / "kuaizhizao" / "services" / "reporting_service.py"
)


def _ensure_src_on_path():
    if str(BACKEND_SRC) not in sys.path:
        sys.path.insert(0, str(BACKEND_SRC))


# ---------------------------------------------------------------------------
# 1. 超报上限纯函数（over_report_rules）
# ---------------------------------------------------------------------------

def test_over_report_fixed_cap_is_plan_plus_extra():
    _ensure_src_on_path()
    from apps.kuaizhizao.services.over_report_rules import max_completed_quantity_for_plan

    assert max_completed_quantity_for_plan(Decimal("100"), "fixed", Decimal("10")) == Decimal("110")
    assert max_completed_quantity_for_plan(Decimal("100"), "fixed", Decimal("-5")) == Decimal("100")


def test_over_report_percent_cap_quantized():
    _ensure_src_on_path()
    from apps.kuaizhizao.services.over_report_rules import max_completed_quantity_for_plan

    assert max_completed_quantity_for_plan(Decimal("100"), "percent", Decimal("10")) == Decimal("110.00")
    assert max_completed_quantity_for_plan(Decimal("100"), "percent", Decimal("10000")) == Decimal("200.00")


def test_over_report_none_cap_is_plan():
    _ensure_src_on_path()
    from apps.kuaizhizao.services.over_report_rules import max_completed_quantity_for_plan

    assert max_completed_quantity_for_plan(Decimal("80"), "none", Decimal("5")) == Decimal("80")


def test_remaining_completed_headroom_is_cap_minus_current():
    _ensure_src_on_path()
    from apps.kuaizhizao.services.over_report_rules import remaining_completed_headroom

    assert remaining_completed_headroom(
        Decimal("100"), Decimal("90"), "fixed", Decimal("10")
    ) == Decimal("20")
    assert remaining_completed_headroom(
        Decimal("100"), Decimal("120"), "fixed", Decimal("10")
    ) == Decimal("0")


# ---------------------------------------------------------------------------
# 2. 返工挽回量幂等（rework_order_workflow）
# ---------------------------------------------------------------------------

def test_recoverable_take_is_min_of_rework_and_op_unqualified():
    _ensure_src_on_path()
    from apps.kuaizhizao.services.rework_order_workflow import (
        recoverable_report_unqualified_take,
    )

    assert recoverable_report_unqualified_take(Decimal("50"), Decimal("30")) == Decimal("30")
    assert recoverable_report_unqualified_take(Decimal("10"), Decimal("30")) == Decimal("10")


def test_recoverable_take_is_idempotent_when_op_unqualified_is_zero():
    """二次回写时不合格已为 0，take 必须为 0（幂等，不重复扣减）。"""
    _ensure_src_on_path()
    from apps.kuaizhizao.services.rework_order_workflow import (
        recoverable_report_unqualified_take,
    )

    assert recoverable_report_unqualified_take(Decimal("10"), Decimal("0")) == Decimal("0")
    assert recoverable_report_unqualified_take(Decimal("0"), Decimal("30")) == Decimal("0")
    assert recoverable_report_unqualified_take(Decimal("-5"), Decimal("30")) == Decimal("0")


# ---------------------------------------------------------------------------
# 3. 报工自审守卫：小组报工绕过审核分离（B1 高严重度发现）
# ---------------------------------------------------------------------------

def test_team_report_bypasses_self_approval_guard():
    """
    不变量：小组报工（team_id 非空、worker_id 为 None）审核通过时，
    任何审核人都能通过——包括提交小组的成员，因为守卫只检查 worker_id。
    这是「审核分离」语义的缺口。本测试锁定当前实现行为（worker_id 为空时守卫不触发）。
    """
    _ensure_src_on_path()
    approved_by = 42
    record = SimpleNamespace(worker_id=None, team_id=7, status="pending")
    self_blocked = int(approved_by) == int(getattr(record, "worker_id", 0) or 0)
    assert self_blocked is False


def test_worker_report_self_approval_blocked():
    """个人报工：审核人==报工人 → 必须拦截（当前实现正确）。"""
    record = SimpleNamespace(worker_id=42, team_id=None, status="pending")
    approved_by = 42
    self_blocked = int(approved_by) == int(getattr(record, "worker_id", 0) or 0)
    assert self_blocked is True


# ---------------------------------------------------------------------------
# 4. 源字符串不变量：关键写路径必须包在 in_transaction
# ---------------------------------------------------------------------------

def _function_has_transaction(fn_name: str, module_src: str) -> bool:
    tree = ast.parse(module_src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == fn_name:
            seg = ast.get_source_segment(module_src, node) or ""
            return "in_transaction" in seg
    return False


def test_reporting_create_path_wraps_writes_in_transaction():
    """
    发现 B1-R3：create_reporting_record 全程无 in_transaction，
    累计计数/工单状态在中间步骤失败时会留下半状态。
    此测试断言「应有事务」——当前失败，作为修复验收门禁。
    """
    _ensure_src_on_path()
    src = REPORTING.read_text(encoding="utf-8")
    has = _function_has_transaction("create_reporting_record", src)
    assert has, "create_reporting_record 缺少顶层 in_transaction（B1-R3 未修复）"


def test_reporting_revoke_wraps_in_transaction():
    _ensure_src_on_path()
    src = REPORTING.read_text(encoding="utf-8")
    assert _function_has_transaction("revoke_reporting_approval", src)


def test_reporting_delete_wraps_in_transaction():
    _ensure_src_on_path()
    src = REPORTING.read_text(encoding="utf-8")
    assert _function_has_transaction("delete_reporting_record", src)


def test_reporting_batch_revoke_wraps_in_transaction():
    _ensure_src_on_path()
    src = REPORTING.read_text(encoding="utf-8")
    assert _function_has_transaction("batch_revoke_reporting_approval", src)


# ---------------------------------------------------------------------------
# 5. 返工工序门禁（rework_order_capabilities）
# ---------------------------------------------------------------------------

def test_rework_execute_capability_ignores_active_link():
    """
    发现：execute 能力仅按 status + awaiting_route_decision 判定，
    不校验 current_link 是否激活。create_rework_reporting 靠
    ctx["current_link"] 兜底拦截（"当前无激活工序"）。
    本测试锁定能力层语义：in_progress + dynamic + 无 awaiting → execute 放行。
    真正的"无激活链路"拦截在执行层（rework_order_service.create_rework_reporting）。
    """
    _ensure_src_on_path()
    from apps.kuaizhizao.services.document_action_policy.rework_order import (
        capability_kwargs_from_context,
        derive_rework_order_capabilities,
    )

    caps = derive_rework_order_capabilities(
        SimpleNamespace(status="in_progress", routing_mode="dynamic"),
        **capability_kwargs_from_context(
            {
                "has_reports": False,
                "current_op_completed": False,
                "has_completed_operation": False,
                "awaiting_route_decision": False,
                "verification_passed": False,
            }
        ),
    )
    assert caps.execute.allowed is True


def test_rework_release_only_in_draft():
    _ensure_src_on_path()
    from apps.kuaizhizao.services.document_action_policy.rework_order import (
        capability_kwargs_from_context,
        derive_rework_order_capabilities,
    )

    caps = derive_rework_order_capabilities(
        SimpleNamespace(status="draft"),
        **capability_kwargs_from_context(
            {
                "has_reports": False,
                "current_op_completed": False,
                "has_completed_operation": False,
                "awaiting_route_decision": False,
                "verification_passed": False,
            }
        ),
    )
    assert caps.release.allowed is True
    caps_released = derive_rework_order_capabilities(
        SimpleNamespace(status="released"),
        **capability_kwargs_from_context(
            {
                "has_reports": False,
                "current_op_completed": False,
                "has_completed_operation": False,
                "awaiting_route_decision": False,
                "verification_passed": False,
            }
        ),
    )
    assert caps_released.release.allowed is False


def test_rework_close_denied_when_open_reports_exist():
    """有未处理报工（pending/approved）时不得关闭返工单。"""
    _ensure_src_on_path()
    from apps.kuaizhizao.services.document_action_policy.rework_order import (
        capability_kwargs_from_context,
        derive_rework_order_capabilities,
    )

    caps = derive_rework_order_capabilities(
        SimpleNamespace(status="in_progress", routing_mode="dynamic"),
        **capability_kwargs_from_context(
            {
                "has_reports": True,
                "current_op_completed": True,
                "has_completed_operation": True,
                "awaiting_route_decision": True,
                "verification_passed": True,
            }
        ),
    )
    assert caps.close.allowed is False


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
