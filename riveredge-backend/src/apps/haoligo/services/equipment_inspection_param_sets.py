"""设备与点检方案多对多绑定。"""

from __future__ import annotations

from typing import Iterable, List

from fastapi import HTTPException, status

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import (
    HaoligoEquipmentInspectionParamSet,
    HaoligoInspectionParamSet,
)


async def list_equipment_inspection_param_set_ids(tenant_id: int, equipment_id: int) -> List[int]:
    rows = (
        await tenant_alive(HaoligoEquipmentInspectionParamSet, tenant_id)
        .filter(equipment_id=equipment_id)
        .order_by("sort_order", "id")
        .all()
    )
    return [int(r.set_id) for r in rows]


async def sync_equipment_inspection_param_sets(
    tenant_id: int,
    equipment_id: int,
    set_ids: Iterable[int] | None,
) -> List[int]:
    """替换设备绑定的点检方案列表，返回去重后的 id 顺序。"""
    seen: set[int] = set()
    ordered: List[int] = []
    for raw in set_ids or []:
        sid = int(raw)
        if sid < 1 or sid in seen:
            continue
        seen.add(sid)
        ordered.append(sid)
    if ordered:
        found = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id__in=ordered).count()
        if found != len(ordered):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="点检方案不存在")
    await tenant_alive(HaoligoEquipmentInspectionParamSet, tenant_id).filter(equipment_id=equipment_id).delete()
    for idx, sid in enumerate(ordered):
        await HaoligoEquipmentInspectionParamSet.create(
            tenant_id=tenant_id,
            equipment_id=equipment_id,
            set_id=sid,
            sort_order=idx,
        )
    return ordered
