"""好力 GO — 设备维保业务常量。"""

from __future__ import annotations

from typing import Literal

from apps.haoligo.constants.mold_maintenance_complete import (
    MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS,
    MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_SET,
)

EquipmentServiceTypeLiteral = Literal["维修", "保养"]

EQUIPMENT_MAINTENANCE_REPAIR_RESULTS: tuple[str, ...] = MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS
EQUIPMENT_MAINTENANCE_REPAIR_RESULT_SET: frozenset[str] = MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_SET

# 维修完修结果 → 设备 operational_status（数据字典 value）
EQUIPMENT_MAINTENANCE_REPAIR_RESULT_TO_OPERATIONAL_STATUS: dict[str, str] = {
    "维修完成": "running",
    "待观察": "running",
    "需返修": "repair",
    "报废": "shutdown",
    "转外协": "repair",
    "无法修复": "shutdown",
}


def normalize_equipment_service_type(raw: str | None) -> str:
    s = (raw or "").strip()
    if s == "保养":
        return "保养"
    if s in ("维修", "repair"):
        return "维修"
    raise ValueError("维保单类型须为「维修」或「保养」")
