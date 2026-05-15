"""好力 GO — 外协维保完修单审核状态。"""

from __future__ import annotations

OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_STATUSES: tuple[str, ...] = (
    "待审核",
    "已通过",
    "已驳回",
)

OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_STATUS_SET: frozenset[str] = frozenset(
    OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_STATUSES
)

# 完修结论已生效、模具可按维修结果落账
OUTSOURCE_MAINTENANCE_COMPLETE_APPROVED_STATUS = "已通过"
