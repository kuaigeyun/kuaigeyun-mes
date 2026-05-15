"""好力 GO — 模具台账 `HaoligoMold.status` 允许值（与前端台账、系统字典 MOLD_STATUS、领用/维保逻辑一致）。"""

from __future__ import annotations

# 顺序：产品约定（筛选、错误提示按此展示）
MOLD_LEDGER_STATUS_VALUES: tuple[str, ...] = (
    "待启用",
    "待用",
    "在用",
    "维修",
    "保养",
    "外协维修",
    "报废",
    "停用",
)

MOLD_LEDGER_STATUS_SET: frozenset[str] = frozenset(MOLD_LEDGER_STATUS_VALUES)

# 维保单占用模具时禁止领用的状态（与 mold_status_label_for_maintenance_sheet 产出一致）
MAINTENANCE_OCCUPY_STATUSES: frozenset[str] = frozenset({"维修", "保养", "外协维修"})
