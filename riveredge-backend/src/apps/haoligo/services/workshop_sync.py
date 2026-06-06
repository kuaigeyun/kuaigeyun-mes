"""好力 GO 车间：与主数据同步，供设备 FK 使用。"""

from __future__ import annotations

from apps.haoligo.models.equipment import HaoligoWorkshop
from apps.master_data.models.factory import Workshop as MasterWorkshop


async def list_workshops_synced_from_master(tenant_id: int) -> list[HaoligoWorkshop]:
    """
    车间与主数据联动：以主数据「启用且未删除」的车间为准，按 tenant_id + code
    对齐到 haoligo_workshop（新建或更新名称、必要时恢复软删），供好力侧 FK 使用。
    """
    masters = (
        await MasterWorkshop.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        )
        .order_by("code")
        .all()
    )
    synced: list[HaoligoWorkshop] = []
    for m in masters:
        code = (m.code or "").strip()
        name = (m.name or "").strip()
        if not code or not name:
            continue
        existing = await HaoligoWorkshop.filter(tenant_id=tenant_id, code=code).first()
        if existing:
            dirty = False
            if existing.deleted_at is not None:
                existing.deleted_at = None
                dirty = True
            if existing.name != name:
                existing.name = name
                dirty = True
            if dirty:
                await existing.save()
            synced.append(existing)
        else:
            synced.append(
                await HaoligoWorkshop.create(tenant_id=tenant_id, code=code, name=name),
            )

    return synced
