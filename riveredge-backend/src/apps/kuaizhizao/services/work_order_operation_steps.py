"""
工单工序步骤摘要：与运营看板 / 工单列表「工序列」共用同一套 status / progress 口径。
"""

from __future__ import annotations

from typing import Any, Iterable, List, Optional


def map_work_order_operation_step_status(raw_status: Optional[str]) -> str:
    """completed → done，in_progress → active，其它 → pending。"""
    s = raw_status or ""
    if s in ("completed", "completed_force", "已完成"):
        return "done"
    if s in ("in_progress", "进行中"):
        return "active"
    return "pending"


def build_work_order_operation_steps(
    operations: Iterable[dict[str, Any]],
    plan_quantity: float,
) -> List[dict[str, Any]]:
    """
    将工单工序行转为步骤轴数据。

    progress（仅 active）：min(100, 有效合格 / plan * 100)。
    有效合格优先 transfer_qualified_quantity（方案质检放行数），否则报工合格数。
    不以进度 100% 强制 done：未检验放行时工序 status 仍为 in_progress。
    """
    plan = float(plan_quantity or 0)
    steps: list[dict[str, Any]] = []
    for op in operations:
        status = map_work_order_operation_step_status(op.get("status"))
        progress = 0
        if status == "done":
            progress = 100
        elif status == "active" and plan > 0:
            if op.get("transfer_qualified_quantity") is not None:
                qty = float(op.get("transfer_qualified_quantity") or 0)
            else:
                qty = float(op.get("qualified_quantity") or 0)
            progress = int(min(100, round(qty / plan * 100)))
        steps.append(
            {
                "name": op.get("operation_name") or "",
                "sequence": op.get("sequence") or 0,
                "status": status,
                "progress": progress,
            }
        )
    return steps
