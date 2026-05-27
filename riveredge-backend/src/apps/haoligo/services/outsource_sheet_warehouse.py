"""外协维保单 / 外协维保完修单审核通过时的模具仓库调拨与展示字段。"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException, status

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_warehouse import (
    MOLD_WAREHOUSE_TYPE_EXTERNAL,
    MOLD_WAREHOUSE_TYPE_INTERNAL,
)
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.models.mold_warehouse import HaoligoMoldWarehouse
from apps.haoligo.services.trial_sheet_side_effects import (
    _apply_mold_warehouse_by_id,
    _warehouse_matches_supplier,
    resolve_supplier_by_name,
)
from apps.master_data.models.supplier import Supplier as MasterSupplier

BEFORE_OUTSOURCE_WAREHOUSE_KEY = "before_outsource_warehouse_id"


def format_mold_warehouse_label(
    *,
    warehouse_name: Optional[str],
    warehouse_code: Optional[str],
) -> Optional[str]:
    name = (warehouse_name or "").strip()
    code = (warehouse_code or "").strip()
    if name and code:
        return f"{code} · {name}"
    return name or code or None


async def resolve_outsource_external_warehouse_id(
    tenant_id: int,
    *,
    outsourced_unit_name: str,
    outsourced_unit_code: Optional[str] = None,
) -> int:
    """解析外协单位对应的外部模具仓库（规则与试模单供应商外部仓一致）。"""
    name = (outsourced_unit_name or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="外协单位不能为空，无法解析外协仓库",
        )
    sup = await resolve_supplier_by_name(tenant_id, name)
    if sup is None and outsourced_unit_code:
        code = (outsourced_unit_code or "").strip()
        if code:
            sup = await MasterSupplier.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code=code,
            ).first()
    rows = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(
        warehouse_type=MOLD_WAREHOUSE_TYPE_EXTERNAL,
    ).all()
    matched = [wh for wh in rows if _warehouse_matches_supplier(wh, sup, name)]
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"外协单位「{name}」暂无外部模具仓库，请先在模具仓库中维护",
        )
    return int(matched[0].id)


def _origin_warehouse_id_from_line(raw: dict[str, Any]) -> Optional[int]:
    v = raw.get(BEFORE_OUTSOURCE_WAREHOUSE_KEY)
    if v is None or v == "":
        return None
    try:
        n = int(v)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None


def origin_warehouse_by_mold_from_source_lines(source_line_items: list[Any]) -> dict[str, int]:
    out: dict[str, int] = {}
    for item in source_line_items or []:
        if not isinstance(item, dict):
            continue
        mc = str(item.get("mold_code") or "").strip()
        oid = _origin_warehouse_id_from_line(item)
        if mc and oid:
            out[mc] = oid
    return out


async def mold_warehouse_snapshot_by_codes(
    tenant_id: int,
    mold_codes: list[str],
) -> dict[str, dict[str, Any]]:
    codes = [c.strip() for c in mold_codes if c and c.strip()]
    if not codes:
        return {}
    molds = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code__in=codes).all()
    out: dict[str, dict[str, Any]] = {}
    for m in molds:
        mc = (m.mold_code or "").strip()
        if not mc:
            continue
        out[mc] = {
            "mold_warehouse_id": m.mold_warehouse_id,
            "mold_warehouse_code": (m.mold_warehouse_code or "").strip() or None,
            "mold_warehouse_name": (m.mold_warehouse_name or "").strip() or None,
        }
    return out


def merge_line_warehouse_fields(
    line_update: dict[str, Any],
    *,
    snapshot: dict[str, Any],
    raw: dict[str, Any],
) -> dict[str, Any]:
    merged = {**line_update, **snapshot}
    before_id = _origin_warehouse_id_from_line(raw)
    if before_id is not None:
        merged["before_outsource_warehouse_id"] = before_id
    return merged


async def apply_warehouses_on_outsource_maintenance_approved(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
) -> None:
    """外协维保单审核通过：记录厂内原仓库，模具转入外协单位外部仓。"""
    ext_wh_id = await resolve_outsource_external_warehouse_id(
        tenant_id,
        outsourced_unit_name=row.outsourced_unit_name or "",
        outsourced_unit_code=row.outsourced_unit_code,
    )
    items = list(row.line_items or [])
    changed = False
    for i, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        mc = str(raw.get("mold_code") or "").strip()
        if not mc:
            continue
        mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
        if not mold:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"未找到模具代号「{mc}」",
            )
        origin = mold.mold_warehouse_id
        item = dict(raw)
        item[BEFORE_OUTSOURCE_WAREHOUSE_KEY] = int(origin) if origin else None
        await _apply_mold_warehouse_by_id(mold, tenant_id=tenant_id, warehouse_id=ext_wh_id)
        await mold.save(
            update_fields=["mold_warehouse_id", "mold_warehouse_code", "mold_warehouse_name", "updated_at"]
        )
        items[i] = item
        changed = True
    if changed:
        row.line_items = items
        await row.save(update_fields=["line_items", "updated_at"])


async def apply_warehouses_on_outsource_complete_approved(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
) -> None:
    """外协维保完修单审核通过：模具从外协仓转回外协维保单记录的厂内仓库。"""
    by_mold: dict[str, int] = {}
    sid = row.source_outsource_maintenance_sheet_id
    if sid:
        src = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=sid).first()
        if src:
            by_mold = origin_warehouse_by_mold_from_source_lines(list(src.line_items or []))
    for raw in row.line_items or []:
        if not isinstance(raw, dict):
            continue
        mc = str(raw.get("mold_code") or "").strip()
        if not mc:
            continue
        target_id = by_mold.get(mc)
        if not target_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"模具「{mc}」缺少外协发出前的厂内仓库记录，无法完修入库"
                    "（请确认关联外协维保单已审核通过）"
                ),
            )
        wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=target_id).first()
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模具「{mc}」的归还仓库不存在",
            )
        if (wh.warehouse_type or "").strip() != MOLD_WAREHOUSE_TYPE_INTERNAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模具「{mc}」的归还仓库须为内部模具仓库",
            )
        mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
        if not mold:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"未找到模具代号「{mc}」",
            )
        await _apply_mold_warehouse_by_id(mold, tenant_id=tenant_id, warehouse_id=target_id)
        await mold.save(
            update_fields=["mold_warehouse_id", "mold_warehouse_code", "mold_warehouse_name", "updated_at"]
        )
