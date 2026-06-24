"""好力 GO — 设备验收台账结案（复用设备台账创建逻辑）。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Iterable, List, Optional

from fastapi import HTTPException, status

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import (
    HaoligoEquipment,
    HaoligoEquipmentCategory,
    HaoligoManufacturer,
    HaoligoWorkshop,
)
from apps.haoligo.models.equipment_upkeep_param import HaoligoEquipmentUpkeepParamSet
from apps.haoligo.models.equipment_acceptance import HaoligoEquipmentAcceptanceSheet
from apps.haoligo.services.equipment_inspection_param_sets import sync_equipment_inspection_param_sets
from apps.haoligo.services.equipment_operational_status import normalize_operational_status


def _norm_uuid_list(v: Optional[Iterable[str]]) -> List[str]:
    if not v:
        return []
    out: List[str] = []
    for x in v:
        s = (x or "").strip()
        if s:
            out.append(s)
    return out


def _normalize_equipment_criticality(v: Optional[str]) -> Optional[str]:
    if v is None or not str(v).strip():
        return None
    s = str(v).strip().upper()
    if s not in ("A", "B", "C"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="设备重要等级必须为 A、B、C 之一或留空",
        )
    return s


async def _validate_equipment_upkeep_param_set_id(tenant_id: int, upkeep_param_set_id: int | None) -> None:
    if upkeep_param_set_id is None:
        return
    exists = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=upkeep_param_set_id).exists()
    if not exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养方案不存在")


async def link_acceptance_equipment(
    tenant_id: int,
    header: HaoligoEquipmentAcceptanceSheet,
    equipment_id: int,
) -> int:
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not eq:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    return int(eq.id)


async def create_equipment_from_acceptance(
    tenant_id: int,
    header: HaoligoEquipmentAcceptanceSheet,
    *,
    asset_code: str,
    category_id: int,
    workshop_id: int,
    name: str | None = None,
    manufacturer_id: int | None = None,
    manufacture_date: date | None = None,
    inspection_param_set_ids: List[int] | None = None,
    upkeep_param_set_id: int | None = None,
    criticality: str | None = None,
    operational_status: str | None = None,
    remark: str | None = None,
    image_file_uuids: List[str] | None = None,
    maintenance_cycle_by_yield: Decimal | None = None,
    maintenance_cycle_by_days: int | None = None,
) -> int:
    if not await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(id=category_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备类别不存在")
    if not await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=workshop_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")

    resolved_name = (name or header.equipment_name or "").strip() or asset_code.strip()
    if not resolved_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写设备名称")

    resolved_mfr_id = manufacturer_id if manufacturer_id is not None else header.manufacturer_id
    if resolved_mfr_id is not None and not await tenant_alive(HaoligoManufacturer, tenant_id).filter(
        id=resolved_mfr_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="制造商不存在")

    code = asset_code.strip()
    if await tenant_alive(HaoligoEquipment, tenant_id).filter(asset_code=code).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="资产编号已存在")

    await _validate_equipment_upkeep_param_set_id(tenant_id, upkeep_param_set_id)

    remark_text = (remark or "").strip() or (header.install_location or "").strip() or None
    status_value = await normalize_operational_status(tenant_id, operational_status or "standby")

    row = await HaoligoEquipment.create(
        tenant_id=tenant_id,
        asset_code=code,
        name=resolved_name,
        category_id=category_id,
        workshop_id=workshop_id,
        manufacturer_id=resolved_mfr_id,
        manufacture_date=manufacture_date,
        inspection_param_set_id=None,
        upkeep_param_set_id=upkeep_param_set_id,
        criticality=_normalize_equipment_criticality(criticality),
        operational_status=status_value,
        remark=remark_text,
        image_file_uuids=_norm_uuid_list(image_file_uuids),
        maintenance_cycle_by_yield=maintenance_cycle_by_yield,
        maintenance_cycle_by_days=maintenance_cycle_by_days,
        used_yield=Decimal("0"),
    )
    await sync_equipment_inspection_param_sets(tenant_id, row.id, inspection_param_set_ids or [])
    return int(row.id)
