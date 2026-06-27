"""设备维保单 / 维保完成单对设备台账 operational_status 的影响。"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.repair_result_items import operational_status_from_repair_results
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_status_log import HaoligoEquipmentOperationalStatusLog
from apps.haoligo.models.equipment_upkeep import HaoligoEquipmentUpkeepCompleteSheet, HaoligoEquipmentUpkeepSheet


async def _set_equipment_operational_status(
    tenant_id: int,
    equipment_id: int,
    new_status: str,
    *,
    changed_by_user_id: int,
) -> None:
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not eq:
        return
    normalized = (new_status or "").strip().lower()
    if not normalized:
        return
    old = eq.operational_status
    if (old or "").strip().lower() == normalized:
        return
    eq.operational_status = normalized
    await eq.save(update_fields=["operational_status"])
    await HaoligoEquipmentOperationalStatusLog.create(
        tenant_id=tenant_id,
        equipment_id=eq.id,
        old_status=old,
        new_status=normalized,
        changed_by_user_id=changed_by_user_id,
    )


async def _has_open_upkeep_sheet(tenant_id: int, equipment_id: int) -> bool:
    """是否存在尚未关联维保完成单的维保单。"""
    sheets = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(equipment_id=equipment_id).all()
    if not sheets:
        return False
    sheet_ids = [s.id for s in sheets]
    linked = set(
        await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id)
        .filter(source_upkeep_sheet_id__in=sheet_ids, deleted_at__isnull=True)
        .values_list("source_upkeep_sheet_id", flat=True)
    )
    return any(sid for sid in sheet_ids if sid not in linked)


async def resolve_open_upkeep_service_type(tenant_id: int, equipment_id: int) -> Optional[str]:
    """取该设备最新一张未完修维保单的 service_type。"""
    sheets = (
        await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id)
        .filter(equipment_id=equipment_id)
        .order_by("-id")
        .all()
    )
    if not sheets:
        return None
    sheet_ids = [s.id for s in sheets]
    linked = set(
        await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id)
        .filter(source_upkeep_sheet_id__in=sheet_ids, deleted_at__isnull=True)
        .values_list("source_upkeep_sheet_id", flat=True)
    )
    for s in sheets:
        if s.id not in linked:
            return (s.service_type or "保养").strip()
    return None


async def resolve_latest_complete_operational_status(tenant_id: int, equipment_id: int) -> Optional[str]:
    """取该设备最近一张维保完成单推导的 operational_status。"""
    sheets = (
        await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id)
        .filter(equipment_id=equipment_id)
        .values_list("id", flat=True)
    )
    sheet_id_list = [int(x) for x in sheets]
    if not sheet_id_list:
        return None
    row = (
        await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id)
        .filter(source_upkeep_sheet_id__in=sheet_id_list)
        .order_by("-id")
        .first()
    )
    if not row:
        return None
    st = (row.service_type or "保养").strip()
    if st == "保养":
        return "running"
    rr = (row.repair_result or "").strip()
    if not rr:
        return None
    return operational_status_from_repair_results(rr)


async def refresh_equipment_status_after_maintenance_change(
    tenant_id: int,
    equipment_id: int,
    *,
    changed_by_user_id: int,
) -> None:
    """维保单/完成单变更后重算设备运行状态。"""
    open_st = await resolve_open_upkeep_service_type(tenant_id, equipment_id)
    if open_st == "维修":
        await _set_equipment_operational_status(
            tenant_id, equipment_id, "repair", changed_by_user_id=changed_by_user_id
        )
        return
    if open_st == "保养":
        return
    target = await resolve_latest_complete_operational_status(tenant_id, equipment_id)
    if target:
        await _set_equipment_operational_status(
            tenant_id, equipment_id, target, changed_by_user_id=changed_by_user_id
        )
        return
    await _set_equipment_operational_status(
        tenant_id, equipment_id, "running", changed_by_user_id=changed_by_user_id
    )


async def apply_equipment_status_on_upkeep_sheet_created(
    tenant_id: int,
    equipment_id: int,
    *,
    service_type: str,
    changed_by_user_id: int,
) -> None:
    """新建维保单：仅维修单占用为 repair。"""
    if (service_type or "").strip() == "维修":
        await _set_equipment_operational_status(
            tenant_id, equipment_id, "repair", changed_by_user_id=changed_by_user_id
        )


async def apply_upkeep_clear_total_to_equipment(tenant_id: int, equipment_id: int, *, clear: bool) -> None:
    if not clear:
        return
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if eq:
        eq.used_yield = Decimal("0")
        await eq.save(update_fields=["used_yield", "updated_at"])


async def adjust_equipment_used_yield(tenant_id: int, equipment_id: int, delta: Decimal) -> None:
    """产出单完成数量变更时同步台账累计产量。"""
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not eq:
        return
    cur = eq.used_yield if eq.used_yield is not None else Decimal("0")
    ny = cur + delta
    if ny < 0:
        ny = Decimal("0")
    eq.used_yield = ny
    await eq.save(update_fields=["used_yield", "updated_at"])
