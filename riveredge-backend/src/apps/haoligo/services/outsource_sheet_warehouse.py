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
DISPATCH_MOLD_WAREHOUSE_KEY = "dispatch_mold_warehouse_id"
DISPLAY_MOLD_WAREHOUSE_ID = "display_mold_warehouse_id"
DISPLAY_MOLD_WAREHOUSE_CODE = "display_mold_warehouse_code"
DISPLAY_MOLD_WAREHOUSE_NAME = "display_mold_warehouse_name"
CLOSED_WAREHOUSE_DISPLAY_LABEL = "已结案"


def format_mold_warehouse_label(
    *,
    warehouse_name: Optional[str],
    warehouse_code: Optional[str],
) -> Optional[str]:
    name = (warehouse_name or "").strip()
    if name == CLOSED_WAREHOUSE_DISPLAY_LABEL:
        return CLOSED_WAREHOUSE_DISPLAY_LABEL
    code = (warehouse_code or "").strip()
    if name and code:
        return f"{code} - {name}"
    return name or code or None


def _warehouse_fields_from_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "mold_warehouse_id": snapshot.get("mold_warehouse_id"),
        "mold_warehouse_code": snapshot.get("mold_warehouse_code"),
        "mold_warehouse_name": snapshot.get("mold_warehouse_name"),
    }


def _closed_warehouse_fields() -> dict[str, Any]:
    return {
        "mold_warehouse_id": None,
        "mold_warehouse_code": None,
        "mold_warehouse_name": CLOSED_WAREHOUSE_DISPLAY_LABEL,
    }


def _display_warehouse_from_line_raw(raw: dict[str, Any]) -> Optional[dict[str, Any]]:
    name = (raw.get(DISPLAY_MOLD_WAREHOUSE_NAME) or "").strip()
    code = (raw.get(DISPLAY_MOLD_WAREHOUSE_CODE) or "").strip()
    wid = raw.get(DISPLAY_MOLD_WAREHOUSE_ID)
    if not name and not code and wid in (None, ""):
        return None
    try:
        wh_id = int(wid) if wid not in (None, "") else None
        if wh_id is not None and wh_id <= 0:
            wh_id = None
    except (TypeError, ValueError):
        wh_id = None
    return {
        "mold_warehouse_id": wh_id,
        "mold_warehouse_code": code or None,
        "mold_warehouse_name": name or None,
    }


def persist_display_warehouse_on_line(
    item: dict[str, Any],
    *,
    warehouse_id: Optional[int],
    warehouse_code: Optional[str],
    warehouse_name: Optional[str],
) -> dict[str, Any]:
    out = dict(item)
    out[DISPLAY_MOLD_WAREHOUSE_ID] = int(warehouse_id) if warehouse_id else None
    out[DISPLAY_MOLD_WAREHOUSE_CODE] = (warehouse_code or "").strip() or None
    out[DISPLAY_MOLD_WAREHOUSE_NAME] = (warehouse_name or "").strip() or None
    return out


async def warehouse_snapshot_by_id(tenant_id: int, warehouse_id: int) -> Optional[dict[str, Any]]:
    if warehouse_id <= 0:
        return None
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=warehouse_id).first()
    if not wh:
        return None
    return {
        "mold_warehouse_id": wh.id,
        "mold_warehouse_code": (wh.warehouse_code or "").strip() or None,
        "mold_warehouse_name": (wh.warehouse_name or "").strip() or None,
    }


async def resolve_outsource_unit_fields(
    tenant_id: int,
    outsourced_unit_name: Optional[str],
    outsourced_unit_code: Optional[str] = None,
) -> tuple[str, Optional[str]]:
    """规范化外协单位名称，并从主数据补全 supplier code（创建/更新入库前调用）。"""
    name = (outsourced_unit_name or "").strip()
    if not name:
        raise ValueError("外协单位不能为空")
    code = (outsourced_unit_code or "").strip() or None
    sup = await resolve_supplier_by_name(tenant_id, name)
    if sup is None and code:
        sup = await MasterSupplier.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            code=code,
        ).first()
    if sup:
        resolved_name = (sup.name or "").strip() or name
        resolved_code = (sup.code or "").strip() or code
        return resolved_name, resolved_code or None
    return name, code


async def external_warehouse_snapshot_for_unit(
    tenant_id: int,
    *,
    outsourced_unit_name: str,
    outsourced_unit_code: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    try:
        ext_wh_id = await resolve_outsource_external_warehouse_id(
            tenant_id,
            outsourced_unit_name=outsourced_unit_name,
            outsourced_unit_code=outsourced_unit_code,
        )
    except HTTPException:
        return None
    return await warehouse_snapshot_by_id(tenant_id, ext_wh_id)


async def resolve_maintenance_line_warehouse_fields(
    tenant_id: int,
    raw: dict[str, Any],
    live_snapshot: dict[str, Any],
    *,
    is_closed: bool,
    is_approved: bool,
    outsourced_unit_name: str,
    outsourced_unit_code: Optional[str] = None,
) -> dict[str, Any]:
    """外协维保单展示用仓库：已结案固定为「已结案」，进行中/已通过用审核快照，草稿读台账。"""
    stored = _display_warehouse_from_line_raw(raw)
    if is_closed:
        return stored or _closed_warehouse_fields()
    if stored:
        return stored
    if is_approved:
        ext = await external_warehouse_snapshot_for_unit(
            tenant_id,
            outsourced_unit_name=outsourced_unit_name,
            outsourced_unit_code=outsourced_unit_code,
        )
        if ext:
            return _warehouse_fields_from_snapshot(ext)
    merged = merge_line_warehouse_fields({}, snapshot=live_snapshot, raw=raw)
    return _warehouse_fields_from_snapshot(merged)


async def resolve_complete_line_warehouse_fields(
    tenant_id: int,
    raw: dict[str, Any],
    live_snapshot: dict[str, Any],
    source_raw: Optional[dict[str, Any]],
    *,
    is_approved: bool,
) -> dict[str, Any]:
    """外协维保完修单展示用仓库：已通过用完修归还仓快照，草稿/待审读台账。"""
    stored = _display_warehouse_from_line_raw(raw)
    if stored:
        return stored
    if is_approved:
        before_id = _origin_warehouse_id_from_line(source_raw or {})
        if before_id:
            snap = await warehouse_snapshot_by_id(tenant_id, before_id)
            if snap:
                return _warehouse_fields_from_snapshot(snap)
        return _closed_warehouse_fields()
    merged = merge_line_warehouse_fields({}, snapshot=live_snapshot, raw=raw)
    return _warehouse_fields_from_snapshot(merged)


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


def _dispatch_mold_warehouse_id_from_line(raw: dict[str, Any]) -> Optional[int]:
    v = raw.get(DISPATCH_MOLD_WAREHOUSE_KEY)
    if v is None or v == "":
        return None
    try:
        n = int(v)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None


async def _internal_warehouse_id_for_location(
    tenant_id: int,
    warehouse_id: Optional[int],
) -> Optional[int]:
    """仅当仓库为厂内仓（或非明确外部仓）时返回其 ID。"""
    if warehouse_id is None or int(warehouse_id) < 1:
        return None
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=int(warehouse_id)).first()
    if not wh:
        return None
    wh_type = (wh.warehouse_type or "").strip()
    if wh_type == MOLD_WAREHOUSE_TYPE_EXTERNAL:
        return None
    if wh_type == MOLD_WAREHOUSE_TYPE_INTERNAL or not wh_type:
        return int(wh.id)
    return None


async def _validate_internal_warehouse_id(tenant_id: int, warehouse_id: int) -> Optional[int]:
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=int(warehouse_id)).first()
    if not wh:
        return None
    if (wh.warehouse_type or "").strip() not in ("", MOLD_WAREHOUSE_TYPE_INTERNAL):
        return None
    return int(wh.id)


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


async def _infer_before_outsource_warehouse_id(
    tenant_id: int,
    *,
    mold_code: str,
) -> Optional[int]:
    """历史外协维保单未写入 before_outsource 时：若模具仍在厂内仓，用当前台账仓库补推断。"""
    mc = mold_code.strip()
    if not mc:
        return None
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold or not mold.mold_warehouse_id:
        return None
    return await _internal_warehouse_id_for_location(tenant_id, mold.mold_warehouse_id)


async def _mold_at_outsource_external_warehouse(
    tenant_id: int,
    mold: HaoligoMold,
    src: HaoligoMoldOutsourceMaintenanceSheet,
) -> bool:
    if not mold.mold_warehouse_id:
        return False
    try:
        ext_id = await resolve_outsource_external_warehouse_id(
            tenant_id,
            outsourced_unit_name=src.outsourced_unit_name or "",
            outsourced_unit_code=src.outsourced_unit_code,
        )
    except HTTPException:
        return False
    return int(mold.mold_warehouse_id) == int(ext_id)


async def _before_outsource_from_prior_outsource_sheets(
    tenant_id: int,
    mold_code: str,
    *,
    exclude_sheet_id: Optional[int] = None,
    before_audited_at=None,
) -> Optional[int]:
    from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED

    qs = tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(
        sheet_status=SHEET_STATUS_APPROVED,
    )
    if before_audited_at is not None:
        qs = qs.filter(audited_at__lt=before_audited_at)
    rows = await qs.order_by("-audited_at", "-id").all()
    mc = mold_code.strip()
    for sheet in rows:
        if exclude_sheet_id is not None and sheet.id == exclude_sheet_id:
            continue
        for item in sheet.line_items or []:
            if not isinstance(item, dict):
                continue
            if str(item.get("mold_code") or "").strip() != mc:
                continue
            oid = _origin_warehouse_id_from_line(item)
            if oid:
                validated = await _validate_internal_warehouse_id(tenant_id, oid)
                if validated:
                    return validated
            dispatch_id = _dispatch_mold_warehouse_id_from_line(item)
            if dispatch_id:
                validated = await _validate_internal_warehouse_id(tenant_id, dispatch_id)
                if validated:
                    return validated
    return None


async def _dispatch_origin_from_trial_sheets(tenant_id: int, mold_code: str) -> Optional[int]:
    from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet

    mc = mold_code.strip()
    if not mc:
        return None
    rows = await (
        tenant_alive(HaoligoMoldTrialSheet, tenant_id)
        .filter(mold_code=mc)
        .exclude(dispatch_origin_warehouse_id__isnull=True)
        .order_by("-audited_at", "-id")
        .all()
    )
    for row in rows:
        origin_id = getattr(row, "dispatch_origin_warehouse_id", None)
        if origin_id is None:
            continue
        validated = await _validate_internal_warehouse_id(tenant_id, int(origin_id))
        if validated:
            return validated
    return None


async def _infer_before_outsource_for_legacy_outsourced_mold(
    tenant_id: int,
    *,
    mold_code: str,
    src: HaoligoMoldOutsourceMaintenanceSheet,
    source_raw: Optional[dict[str, Any]],
) -> Optional[int]:
    """已审核外协发出、模具已在外协仓但来源行缺失 before_outsource 时的历史补推断。"""
    mc = mold_code.strip()
    if not mc:
        return None
    if source_raw:
        dispatch_id = _dispatch_mold_warehouse_id_from_line(source_raw)
        if dispatch_id:
            validated = await _validate_internal_warehouse_id(tenant_id, dispatch_id)
            if validated:
                return validated
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold:
        return None
    if not await _mold_at_outsource_external_warehouse(tenant_id, mold, src):
        return None
    prior = await _before_outsource_from_prior_outsource_sheets(
        tenant_id,
        mc,
        exclude_sheet_id=src.id,
        before_audited_at=getattr(src, "audited_at", None),
    )
    if prior:
        return prior
    return await _dispatch_origin_from_trial_sheets(tenant_id, mc)


async def resolve_return_warehouse_id_for_complete_line(
    tenant_id: int,
    *,
    source_raw: Optional[dict[str, Any]],
    complete_raw: Optional[dict[str, Any]],
    mold_code: str,
    src: Optional[HaoligoMoldOutsourceMaintenanceSheet] = None,
) -> Optional[int]:
    """解析完修归还厂内仓库 ID（来源行 / 完修行 / 台账与历史推断，只读不落库）。"""
    for raw in (source_raw, complete_raw):
        if raw:
            oid = _origin_warehouse_id_from_line(raw)
            if oid:
                validated = await _validate_internal_warehouse_id(tenant_id, oid)
                if validated:
                    return validated
            dispatch_id = _dispatch_mold_warehouse_id_from_line(raw)
            if dispatch_id:
                validated = await _validate_internal_warehouse_id(tenant_id, dispatch_id)
                if validated:
                    return validated
    inferred = await _infer_before_outsource_warehouse_id(tenant_id, mold_code=mold_code)
    if inferred:
        return inferred
    if src is not None:
        return await _infer_before_outsource_for_legacy_outsourced_mold(
            tenant_id,
            mold_code=mold_code,
            src=src,
            source_raw=source_raw,
        )
    return None


async def backfill_before_outsource_on_source_lines(
    tenant_id: int,
    src: HaoligoMoldOutsourceMaintenanceSheet,
    *,
    complete_line_items: list[Any] | None = None,
) -> dict[str, int]:
    """补全来源外协维保单行上的 before_outsource_warehouse_id，返回 mold_code→仓库 ID。"""
    by_mold = origin_warehouse_by_mold_from_source_lines(list(src.line_items or []))
    complete_by_mold: dict[str, dict[str, Any]] = {}
    for item in complete_line_items or []:
        if not isinstance(item, dict):
            continue
        mc = str(item.get("mold_code") or "").strip()
        if mc:
            complete_by_mold[mc] = item
        oid = _origin_warehouse_id_from_line(item)
        if mc and oid and mc not in by_mold:
            by_mold[mc] = oid

    items = list(src.line_items or [])
    changed = False
    for i, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        mc = str(raw.get("mold_code") or "").strip()
        if not mc or mc in by_mold:
            continue
        resolved = await resolve_return_warehouse_id_for_complete_line(
            tenant_id,
            source_raw=raw,
            complete_raw=complete_by_mold.get(mc),
            mold_code=mc,
            src=src,
        )
        if not resolved:
            continue
        item = dict(raw)
        item[BEFORE_OUTSOURCE_WAREHOUSE_KEY] = resolved
        items[i] = item
        by_mold[mc] = resolved
        changed = True
    if changed:
        src.line_items = items
        await src.save(update_fields=["line_items", "updated_at"])
    return by_mold


async def enrich_source_line_with_dispatch_snapshot(
    tenant_id: int,
    line_dict: dict[str, Any],
) -> dict[str, Any]:
    """创建/更新外协维保单时快照模具当前厂内仓，供历史完修补推断。"""
    if _dispatch_mold_warehouse_id_from_line(line_dict):
        return line_dict
    mc = str(line_dict.get("mold_code") or "").strip()
    if not mc:
        return line_dict
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold:
        return line_dict
    internal_id = await _internal_warehouse_id_for_location(tenant_id, mold.mold_warehouse_id)
    if not internal_id:
        return line_dict
    out = dict(line_dict)
    out[DISPATCH_MOLD_WAREHOUSE_KEY] = internal_id
    return out


async def enrich_source_lines_with_dispatch_snapshots(
    tenant_id: int,
    line_dicts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in line_dicts:
        out.append(await enrich_source_line_with_dispatch_snapshot(tenant_id, item))
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
    ext_snap = await warehouse_snapshot_by_id(tenant_id, ext_wh_id)
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
        origin = await _internal_warehouse_id_for_location(tenant_id, mold.mold_warehouse_id)
        if not origin:
            origin = _dispatch_mold_warehouse_id_from_line(raw)
        item = dict(raw)
        item[BEFORE_OUTSOURCE_WAREHOUSE_KEY] = origin
        if origin and not _dispatch_mold_warehouse_id_from_line(raw):
            item[DISPATCH_MOLD_WAREHOUSE_KEY] = origin
        if ext_snap:
            item = persist_display_warehouse_on_line(
                item,
                warehouse_id=ext_snap.get("mold_warehouse_id"),
                warehouse_code=ext_snap.get("mold_warehouse_code"),
                warehouse_name=ext_snap.get("mold_warehouse_name"),
            )
        await _apply_mold_warehouse_by_id(mold, tenant_id=tenant_id, warehouse_id=ext_wh_id)
        await mold.save(
            update_fields=["mold_warehouse_id", "mold_warehouse_code", "mold_warehouse_name", "updated_at"]
        )
        items[i] = item
        changed = True
    if changed:
        row.line_items = items
        await row.save(update_fields=["line_items", "updated_at"])


def _normalize_return_warehouse_overrides(
    overrides: Optional[dict[str, int]],
) -> dict[str, int]:
    """规范化「审核时手动指定归还仓库」映射：mold_code → warehouse_id（>0）。"""
    out: dict[str, int] = {}
    for mc, wid in (overrides or {}).items():
        code = str(mc or "").strip()
        if not code:
            continue
        try:
            n = int(wid)
        except (TypeError, ValueError):
            continue
        if n > 0:
            out[code] = n
    return out


async def apply_warehouses_on_outsource_complete_approved(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
    *,
    return_warehouse_overrides: Optional[dict[str, int]] = None,
) -> None:
    """外协维保完修单审核通过：模具从外协仓转回外协维保单记录的厂内仓库。

    当来源/历史均无法推断发出前厂内仓库时，允许审核人按 ``return_warehouse_overrides``
    （mold_code → 内部仓库 ID）手动指定归还仓库；指定仓库须存在且为内部模具仓库。
    """
    overrides = _normalize_return_warehouse_overrides(return_warehouse_overrides)
    by_mold: dict[str, int] = {}
    src: Optional[HaoligoMoldOutsourceMaintenanceSheet] = None
    src_line_by_mold: dict[str, dict[str, Any]] = {}
    sid = row.source_outsource_maintenance_sheet_id
    if sid:
        src = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=sid).first()
        if src:
            from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED

            src_status = str(getattr(src, "sheet_status", "") or "").strip()
            if src_status != SHEET_STATUS_APPROVED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="关联外协维保单尚未审核通过，请先审核外协维保单后再通过外协维保完修单",
                )
            for item in src.line_items or []:
                if isinstance(item, dict):
                    mc = str(item.get("mold_code") or "").strip()
                    if mc:
                        src_line_by_mold[mc] = item
            by_mold = await backfill_before_outsource_on_source_lines(
                tenant_id,
                src,
                complete_line_items=list(row.line_items or []),
            )
    items = list(row.line_items or [])
    lines_changed = False
    for i, raw in enumerate(items):
        if not isinstance(raw, dict):
            continue
        mc = str(raw.get("mold_code") or "").strip()
        if not mc:
            continue
        target_id = by_mold.get(mc)
        if not target_id:
            target_id = await resolve_return_warehouse_id_for_complete_line(
                tenant_id,
                source_raw=src_line_by_mold.get(mc),
                complete_raw=raw,
                mold_code=mc,
                src=src,
            )
        override_used = False
        if not target_id:
            ov = overrides.get(mc)
            if ov:
                target_id = ov
                override_used = True
        if not target_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"模具「{mc}」缺少外协发出前的厂内仓库记录，无法完修入库"
                    "（请确认关联外协维保单已审核通过，且发出前模具位于厂内仓库；"
                    "或在审核时手动指定归还的厂内仓库）"
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
        item = persist_display_warehouse_on_line(
            dict(raw),
            warehouse_id=wh.id,
            warehouse_code=(wh.warehouse_code or "").strip() or None,
            warehouse_name=(wh.warehouse_name or "").strip() or None,
        )
        if override_used:
            item[BEFORE_OUTSOURCE_WAREHOUSE_KEY] = int(target_id)
        if item != raw:
            items[i] = item
            lines_changed = True
    if lines_changed:
        row.line_items = items
        await row.save(update_fields=["line_items", "updated_at"])
