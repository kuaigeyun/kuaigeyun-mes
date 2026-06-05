"""好力 GO — 保养提醒列表聚合（设备 / 模具报表）。"""

from __future__ import annotations

import heapq
from datetime import datetime
from typing import Any

from tortoise import connections

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.services.maintenance_last_upkeep import fetch_last_upkeep_by_mold
from apps.haoligo.services.maintenance_reminder_eval import (
    evaluate_equipment_reminder,
    evaluate_mold_reminder,
    equipment_sort_key,
    is_actionable_equipment,
    is_actionable_mold,
    mold_sort_key,
    passes_severity_filter,
)
from infra.models.user import User

_EQUIPMENT_REMINDER_FIELDS = (
    "id",
    "asset_code",
    "name",
    "operational_status",
    "maintenance_cycle_by_yield",
    "maintenance_cycle_by_days",
    "used_yield",
)

_MOLD_REMINDER_FIELDS = (
    "id",
    "mold_code",
    "name",
    "status",
    "maintenance_cycle_by_yield",
    "used_yield",
    "total_manufacture_qty",
    "usable_yield",
)


async def fetch_last_upkeep_by_equipment(tenant_id: int) -> dict[str, datetime]:
    conn = connections.get("default")
    rows = await conn.execute_query_dict(
        """
        SELECT e.asset_code AS asset_code, max(c.created_at) AS last_upkeep_at
        FROM haoligo_equipment_upkeep_complete_sheet c
        INNER JOIN haoligo_equipment_upkeep_sheet s
          ON s.id = c.source_upkeep_sheet_id AND s.tenant_id = c.tenant_id
        INNER JOIN haoligo_equipment e ON e.id = s.equipment_id AND e.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1
          AND c.deleted_at IS NULL
          AND trim(coalesce(c.service_type, '')) = '保养'
        GROUP BY e.asset_code
        """,
        [tenant_id],
    )
    out: dict[str, datetime] = {}
    for r in rows:
        code = str(r.get("asset_code") or "").strip()
        at = r.get("last_upkeep_at")
        if code and at is not None:
            out[code] = at
    return out


def _match_keyword(row: dict[str, Any], keyword: str) -> bool:
    if not keyword:
        return True
    kw = keyword.lower()
    hay = f"{row.get('asset_code') or row.get('mold_code') or ''}\n{row.get('name') or ''}".lower()
    return kw in hay


def _parse_reminder_kinds(raw: str | None) -> set[str] | None:
    if not raw or not str(raw).strip():
        return None
    parts = {p.strip() for p in str(raw).split(",") if p.strip()}
    return parts or None


def _full_summary_template() -> dict[str, Any]:
    return {
        "total_ledger": 0,
        "actionable": 0,
        "by_kind": {
            "manual_maintenance": 0,
            "setup_no_cycle": 0,
            "setup_no_baseline": 0,
            "cycle_plan": 0,
        },
        "by_level": {"critical": 0, "warning": 0, "ok": 0},
    }


def _is_workspace_preview(
    *,
    preview: bool,
    keyword: str,
    reminder_kinds: str | None,
    status_filter: str = "",
    severity_min: str | None,
    limit: int | None,
    offset: int,
) -> bool:
    if not preview or limit is None or offset != 0:
        return False
    if keyword or (reminder_kinds or "").strip() or status_filter.strip():
        return False
    if severity_min and str(severity_min).strip().lower() not in ("", "all"):
        return False
    return True


def _equipment_reminder_item(eq: dict[str, Any], ev: Any) -> dict[str, Any]:
    cy = eq.get("maintenance_cycle_by_yield")
    uy = eq.get("used_yield")
    return {
        "id": eq["id"],
        "asset_code": eq["asset_code"],
        "name": eq["name"],
        "operational_status": eq.get("operational_status"),
        "maintenance_cycle_by_yield": str(cy) if cy is not None else None,
        "maintenance_cycle_by_days": eq.get("maintenance_cycle_by_days"),
        "used_yield": str(uy) if uy is not None else None,
        "alert_level": ev.alert_level,
        "alert_reasons": ev.alert_reasons,
        "reminder_kind": ev.reminder_kind,
        "dominant_dimension": ev.dominant_dimension,
        "dominant_ratio": ev.dominant_ratio,
        "last_upkeep_at": ev.last_upkeep_at,
        "days_since_upkeep": ev.days_since_upkeep,
        "yield_usage_pct": ev.yield_usage_pct,
        "days_usage_pct": ev.days_usage_pct,
        "remaining_days": ev.remaining_days,
    }


def _mold_reminder_item(mold: dict[str, Any], ev: Any) -> dict[str, Any]:
    cy = mold.get("maintenance_cycle_by_yield")
    uy = mold.get("used_yield")
    tmq = mold.get("total_manufacture_qty")
    uy2 = mold.get("usable_yield")
    return {
        "id": mold["id"],
        "mold_code": mold["mold_code"],
        "name": mold["name"],
        "status": mold.get("status"),
        "maintenance_cycle_by_yield": str(cy) if cy is not None else None,
        "used_yield": str(uy) if uy is not None else None,
        "total_manufacture_qty": str(tmq) if tmq is not None else None,
        "usable_yield": str(uy2) if uy2 is not None else None,
        "alert_level": ev.alert_level,
        "alert_reasons": ev.alert_reasons,
        "reminder_kind": ev.reminder_kind,
        "dominant_dimension": ev.dominant_dimension,
        "dominant_ratio": ev.dominant_ratio,
        "last_upkeep_at": ev.last_upkeep_at,
        "yield_usage_pct": ev.yield_usage_pct,
        "total_yield_usage_pct": ev.total_yield_usage_pct,
        "remaining_yield_pct": ev.remaining_yield_pct,
    }


class _ReminderHeapEntry:
    """最小堆中存「最不急」项，便于保留最紧急的 limit 条。"""

    __slots__ = ("sort_key", "item")

    def __init__(self, sort_key: tuple, item: dict[str, Any]) -> None:
        self.sort_key = sort_key
        self.item = item

    def __lt__(self, other: _ReminderHeapEntry) -> bool:
        return self.sort_key > other.sort_key


def _push_top_reminders(
    heap: list[_ReminderHeapEntry],
    *,
    sort_key: tuple,
    item: dict[str, Any],
    cap: int,
) -> None:
    entry = _ReminderHeapEntry(sort_key, item)
    if len(heap) < cap:
        heapq.heappush(heap, entry)
    elif sort_key < heap[0].sort_key:
        heapq.heapreplace(heap, entry)


def _finalize_top_reminders(heap: list[_ReminderHeapEntry]) -> list[dict[str, Any]]:
    ordered = sorted(heap, key=lambda e: e.sort_key)
    return [e.item for e in ordered]


async def list_equipment_maintenance_reminders(
    tenant_id: int,
    *,
    keyword: str | None = None,
    severity_min: str | None = None,
    actionable_only: bool = False,
    reminder_kinds: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    label_by_value: dict[str, str] | None = None,
    preview: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    last_map = await fetch_last_upkeep_by_equipment(tenant_id)
    equipments = await (
        tenant_alive(HaoligoEquipment, tenant_id)
        .order_by("asset_code")
        .values(*_EQUIPMENT_REMINDER_FIELDS)
    )

    kw = (keyword or "").strip()
    kind_set = _parse_reminder_kinds(reminder_kinds)
    workspace_preview = _is_workspace_preview(
        preview=preview,
        keyword=kw,
        reminder_kinds=reminder_kinds,
        severity_min=severity_min,
        limit=limit,
        offset=offset,
    )

    summary = _full_summary_template()
    summary["total_ledger"] = len(equipments)
    rows: list[tuple[dict[str, Any], Any]] = []
    top_heap: list[_ReminderHeapEntry] = []
    top_cap = (limit or 0) + offset if workspace_preview and limit is not None else 0

    for eq in equipments:
        ev = evaluate_equipment_reminder(
            asset_code=eq["asset_code"],
            operational_status=eq.get("operational_status"),
            maintenance_cycle_by_yield=eq.get("maintenance_cycle_by_yield"),
            maintenance_cycle_by_days=eq.get("maintenance_cycle_by_days"),
            used_yield=eq.get("used_yield"),
            last_upkeep_by_equipment=last_map,
            label_by_value=label_by_value,
        )
        if ev is None:
            continue

        if not workspace_preview:
            summary["by_kind"][ev.reminder_kind] = summary["by_kind"].get(ev.reminder_kind, 0) + 1
            summary["by_level"][ev.alert_level] = summary["by_level"].get(ev.alert_level, 0) + 1
        if is_actionable_equipment(ev):
            summary["actionable"] += 1

        item = _equipment_reminder_item(eq, ev)
        if workspace_preview:
            if not _match_keyword(item, kw):
                continue
            if kind_set is not None and ev.reminder_kind not in kind_set:
                continue
            if actionable_only and not is_actionable_equipment(ev):
                continue
            if not passes_severity_filter(
                reminder_kind=ev.reminder_kind,
                alert_level=ev.alert_level,
                severity_min=severity_min,
            ):
                continue
            _push_top_reminders(
                top_heap,
                sort_key=equipment_sort_key(ev, item["asset_code"]),
                item=item,
                cap=top_cap,
            )
            continue

        rows.append((item, ev))

    if workspace_preview:
        items = _finalize_top_reminders(top_heap)[offset : offset + (limit or 0)]
        return items, {**summary, "filtered_total": summary["actionable"]}

    filtered = [
        (item, ev)
        for item, ev in rows
        if _match_keyword(item, kw)
        and (kind_set is None or ev.reminder_kind in kind_set)
        and (not actionable_only or is_actionable_equipment(ev))
        and passes_severity_filter(
            reminder_kind=ev.reminder_kind,
            alert_level=ev.alert_level,
            severity_min=severity_min,
        )
    ]
    filtered.sort(key=lambda pair: equipment_sort_key(pair[1], pair[0]["asset_code"]))

    total = len(filtered)
    slice_rows = filtered
    if limit is not None:
        slice_rows = filtered[offset : offset + limit]

    return [item for item, _ in slice_rows], {**summary, "filtered_total": total}


async def list_mold_maintenance_reminders(
    tenant_id: int,
    user: User,
    *,
    keyword: str | None = None,
    severity_min: str | None = None,
    actionable_only: bool = False,
    reminder_kinds: str | None = None,
    status: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    preview: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    last_map = await fetch_last_upkeep_by_mold(tenant_id, user)
    molds = await (
        tenant_alive(HaoligoMold, tenant_id).order_by("mold_code").values(*_MOLD_REMINDER_FIELDS)
    )

    kw = (keyword or "").strip()
    kind_set = _parse_reminder_kinds(reminder_kinds)
    status_filter = (status or "").strip()
    workspace_preview = _is_workspace_preview(
        preview=preview,
        keyword=kw,
        reminder_kinds=reminder_kinds,
        status_filter=status_filter,
        severity_min=severity_min,
        limit=limit,
        offset=offset,
    )

    summary = _full_summary_template()
    summary["total_ledger"] = len(molds)
    rows: list[tuple[dict[str, Any], Any]] = []
    top_heap: list[_ReminderHeapEntry] = []
    top_cap = (limit or 0) + offset if workspace_preview and limit is not None else 0

    for mold in molds:
        ev = evaluate_mold_reminder(
            mold_code=mold["mold_code"],
            status=mold.get("status"),
            maintenance_cycle_by_yield=mold.get("maintenance_cycle_by_yield"),
            used_yield=mold.get("used_yield"),
            total_manufacture_qty=mold.get("total_manufacture_qty"),
            usable_yield=mold.get("usable_yield"),
            last_upkeep_by_mold=last_map,
        )
        if ev is None:
            continue

        if not workspace_preview:
            summary["by_kind"][ev.reminder_kind] = summary["by_kind"].get(ev.reminder_kind, 0) + 1
            summary["by_level"][ev.alert_level] = summary["by_level"].get(ev.alert_level, 0) + 1
        if is_actionable_mold(ev):
            summary["actionable"] += 1

        item = _mold_reminder_item(mold, ev)
        if workspace_preview:
            if not _match_keyword(item, kw):
                continue
            if status_filter and (item.get("status") or "") != status_filter:
                continue
            if kind_set is not None and ev.reminder_kind not in kind_set:
                continue
            if actionable_only and not is_actionable_mold(ev):
                continue
            if not passes_severity_filter(
                reminder_kind=ev.reminder_kind,
                alert_level=ev.alert_level,
                severity_min=severity_min,
            ):
                continue
            _push_top_reminders(
                top_heap,
                sort_key=mold_sort_key(ev, item["mold_code"]),
                item=item,
                cap=top_cap,
            )
            continue

        rows.append((item, ev))

    if workspace_preview:
        items = _finalize_top_reminders(top_heap)[offset : offset + (limit or 0)]
        return items, {**summary, "filtered_total": summary["actionable"]}

    filtered = [
        (item, ev)
        for item, ev in rows
        if _match_keyword(item, kw)
        and (not status_filter or (item.get("status") or "") == status_filter)
        and (kind_set is None or ev.reminder_kind in kind_set)
        and (not actionable_only or is_actionable_mold(ev))
        and passes_severity_filter(
            reminder_kind=ev.reminder_kind,
            alert_level=ev.alert_level,
            severity_min=severity_min,
        )
    ]
    filtered.sort(key=lambda pair: mold_sort_key(pair[1], pair[0]["mold_code"]))

    total = len(filtered)
    slice_rows = filtered
    if limit is not None:
        slice_rows = filtered[offset : offset + limit]

    return [item for item, _ in slice_rows], {**summary, "filtered_total": total}
