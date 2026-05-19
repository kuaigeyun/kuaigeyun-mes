"""设备当前运行状态的起始时间（用于看板停机时长等）。"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Iterable, Optional

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_operations import HaoligoEquipmentStatusAdjustment
from apps.haoligo.models.equipment_status_log import HaoligoEquipmentOperationalStatusLog


def _norm_status(value: Optional[str]) -> str:
    return (value or "").strip().lower()


async def operational_status_since_by_equipment(
    tenant_id: int,
    equipments: Iterable[HaoligoEquipment],
) -> Dict[int, datetime]:
    """
    返回每台设备进入「当前 operational_status」的时间。
    优先取状态调整单的 recorded_at，否则取运行状态变更日志的 created_at。
    """
    status_by_id: Dict[int, str] = {}
    for eq in equipments:
        st = _norm_status(eq.operational_status)
        if st:
            status_by_id[eq.id] = st
    if not status_by_id:
        return {}

    eq_ids = list(status_by_id.keys())
    since: Dict[int, datetime] = {}

    adj_rows = (
        await tenant_alive(HaoligoEquipmentStatusAdjustment, tenant_id)
        .filter(equipment_id__in=eq_ids)
        .order_by("-recorded_at", "-id")
        .values("equipment_id", "new_operational_status", "recorded_at")
    )
    for adj in adj_rows:
        eid = adj["equipment_id"]
        if eid in since:
            continue
        if _norm_status(adj["new_operational_status"]) == status_by_id[eid]:
            since[eid] = adj["recorded_at"]

    missing = [eid for eid in eq_ids if eid not in since]
    if missing:
        log_rows = (
            await tenant_alive(HaoligoEquipmentOperationalStatusLog, tenant_id)
            .filter(equipment_id__in=missing)
            .order_by("-created_at", "-id")
            .values("equipment_id", "new_status", "created_at")
        )
        for log in log_rows:
            eid = log["equipment_id"]
            if eid in since:
                continue
            if _norm_status(log["new_status"]) == status_by_id[eid]:
                since[eid] = log["created_at"]

    return since
