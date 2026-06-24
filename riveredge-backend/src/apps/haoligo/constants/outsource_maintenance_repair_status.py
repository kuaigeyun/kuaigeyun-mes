"""好力 GO — 外协维修单维修进度（派生自审核状态 + 关联完修单，非 sheet_status）。"""

from __future__ import annotations

from typing import Optional

from apps.haoligo.constants.mold_sheet_audit import (
    SHEET_STATUS_APPROVED,
    SHEET_STATUS_PENDING,
)

OUTSOURCE_MAINTENANCE_REPAIR_STATUS_IN_REPAIR = "维修中"
OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETE_PENDING = "完修待审"
OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETED = "维修完成"

OUTSOURCE_MAINTENANCE_REPAIR_STATUSES: tuple[str, ...] = (
    OUTSOURCE_MAINTENANCE_REPAIR_STATUS_IN_REPAIR,
    OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETE_PENDING,
    OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETED,
)

OUTSOURCE_MAINTENANCE_REPAIR_STATUS_SET: frozenset[str] = frozenset(OUTSOURCE_MAINTENANCE_REPAIR_STATUSES)


def derive_outsource_maintenance_repair_status(
    *,
    audit_status: str,
    service_type: str,
    linked_complete_status: Optional[str],
) -> Optional[str]:
    """审核已通过且为维修类时返回维修进度；否则 None。"""
    if (audit_status or "").strip() != SHEET_STATUS_APPROVED:
        return None
    if (service_type or "").strip() != "维修":
        return None
    st = (linked_complete_status or "").strip()
    if not st:
        return OUTSOURCE_MAINTENANCE_REPAIR_STATUS_IN_REPAIR
    if st == SHEET_STATUS_APPROVED:
        return OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETED
    if st == SHEET_STATUS_PENDING:
        return OUTSOURCE_MAINTENANCE_REPAIR_STATUS_COMPLETE_PENDING
    return OUTSOURCE_MAINTENANCE_REPAIR_STATUS_IN_REPAIR
