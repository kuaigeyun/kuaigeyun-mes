"""好力 GO — 设备运行状态聚合（工作台环图，避免拉全量台账）。"""

from __future__ import annotations

from typing import Any

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from tortoise.functions import Count


async def equipment_operational_status_summary(tenant_id: int) -> dict[str, Any]:
    """按 operational_status 分组计数 + 台账总数。"""
    qs = tenant_alive(HaoligoEquipment, tenant_id)
    total = await qs.count()
    rows = await qs.group_by("operational_status").annotate(n=Count("id")).values(
        "operational_status", "n"
    )
    counts: dict[str, int] = {}
    for row in rows:
        raw = row.get("operational_status")
        key = (str(raw).strip().lower() if raw is not None and str(raw).strip() else "") or "_unset"
        counts[key] = int(row.get("n") or 0)
    return {"total": total, "counts": counts}
