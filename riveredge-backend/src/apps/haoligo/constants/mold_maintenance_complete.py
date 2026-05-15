"""好力 GO — 维保完修单业务常量。"""

from __future__ import annotations

# 维修完修：内置可选维修结果（与前端下拉一致）
MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS: tuple[str, ...] = (
    "维修完成",
    "待观察",
    "需返修",
    "报废",
    "转外协",
    "无法修复",
)

MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_SET: frozenset[str] = frozenset(MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS)

# 维修完修：维修结果 → 台账 status（8 态内，不新增）。
# 值为 None 表示结论为可再用：按未删除领用单回落「在用 / 待用」。
MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_TO_STATUS: dict[str, str | None] = {
    "维修完成": None,
    "待观察": None,
    "需返修": "维修",
    "报废": "报废",
    "转外协": "外协维修",
    "无法修复": "报废",
}
