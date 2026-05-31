"""厂内保养/维修单与完成单 — 权限资源码（与 manifest 菜单一致）。"""

from __future__ import annotations

MODULE_MOLD_UPKEEP = "molds-documents-upkeep"
MODULE_MOLD_UPKEEP_COMPLETE = "molds-documents-upkeep-complete"
MODULE_MOLD_REPAIR = "molds-documents-repair"
MODULE_MOLD_REPAIR_COMPLETE = "molds-documents-repair-complete"

# 已废弃：角色需改授 upkeep / repair 独立权限
LEGACY_MODULE_MOLD_MAINTENANCE = "molds-documents-maintenance"
LEGACY_MODULE_MOLD_MAINTENANCE_COMPLETE = "molds-documents-maintenance-complete"

SERVICE_TYPE_UPKEEP = "保养"
SERVICE_TYPE_REPAIR = "维修"
INHOUSE_SERVICE_TYPES = frozenset({SERVICE_TYPE_UPKEEP, SERVICE_TYPE_REPAIR})


def sheet_module_for_service_type(service_type: str) -> str:
    st = (service_type or "").strip()
    if st == SERVICE_TYPE_UPKEEP:
        return MODULE_MOLD_UPKEEP
    if st == SERVICE_TYPE_REPAIR:
        return MODULE_MOLD_REPAIR
    raise ValueError(f"无效的维修/保养类型: {service_type!r}")


def complete_module_for_service_type(service_type: str) -> str:
    st = (service_type or "").strip()
    if st == SERVICE_TYPE_UPKEEP:
        return MODULE_MOLD_UPKEEP_COMPLETE
    if st == SERVICE_TYPE_REPAIR:
        return MODULE_MOLD_REPAIR_COMPLETE
    raise ValueError(f"无效的维修/保养类型: {service_type!r}")
