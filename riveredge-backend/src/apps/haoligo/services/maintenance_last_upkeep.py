"""好力 GO — 保养完修最近时间聚合（厂内 + 外协）。"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from apps.haoligo.api._data_scope import (
    RESOURCE_OUTSOURCE_COMPLETE,
    apply_outsource_sheet_scope,
    user_is_external_partner,
)
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from infra.models.user import User


def collect_latest_from_line_items(
    items_map: dict[str, datetime],
    *,
    line_items: Any,
    upkeep_at: datetime | None,
) -> None:
    if upkeep_at is None or not isinstance(line_items, list):
        return
    for elem in line_items:
        if not isinstance(elem, dict):
            continue
        mold_code = str(elem.get("mold_code") or "").strip()
        if not mold_code:
            continue
        prev = items_map.get(mold_code)
        if prev is None or upkeep_at > prev:
            items_map[mold_code] = upkeep_at


async def fetch_last_upkeep_by_mold(tenant_id: int, user: User) -> dict[str, datetime]:
    out: dict[str, datetime] = {}

    if not await user_is_external_partner(tenant_id, user):
        inhouse_rows = await HaoligoMoldMaintenanceCompleteSheet.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            service_type="保养",
        ).all()
        for row in inhouse_rows:
            collect_latest_from_line_items(
                out,
                line_items=getattr(row, "line_items", None),
                upkeep_at=getattr(row, "created_at", None),
            )

    outsource_qs = HaoligoMoldOutsourceMaintenanceCompleteSheet.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        sheet_status="已通过",
        service_type="保养",
    )
    outsource_qs = await apply_outsource_sheet_scope(
        outsource_qs,
        tenant_id=tenant_id,
        user=user,
        resource=RESOURCE_OUTSOURCE_COMPLETE,
    )
    for row in await outsource_qs.all():
        collect_latest_from_line_items(
            out,
            line_items=getattr(row, "line_items", None),
            upkeep_at=getattr(row, "created_at", None),
        )
    return out
