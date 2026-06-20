"""好力 GO — 保养提醒评估（设备 / 模具，与前端 utils 口径一致）。"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal
from core.utils.timezone_utils import to_api_isoformat

AlertLevel = Literal["critical", "warning", "ok"]
EquipmentReminderKind = Literal[
    "manual_maintenance",
    "cycle_plan",
    "setup_no_cycle",
    "setup_no_baseline",
]
MoldReminderKind = Literal[
    "manual_maintenance",
    "cycle_plan",
    "setup_no_cycle",
    "setup_no_baseline",
]
EquipmentDimension = Literal["yield", "days"]
MoldDimension = Literal["yield", "yield_total"]

WARN_RATIO = Decimal("0.9")
MANUAL_EQUIPMENT_STATUS = frozenset({"upkeep", "maintenance", "保养"})
MOLD_IN_USE_STATUSES = frozenset({"在用"})


def _parse_dec(value: Any) -> Decimal | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    try:
        return Decimal(text)
    except Exception:
        return None


def _parse_positive_int(value: Any) -> int | None:
    n = _parse_dec(value)
    if n is None or n <= 0:
        return None
    return int(n)


def _level_from_ratio(ratio: Decimal) -> AlertLevel:
    if ratio >= Decimal("1"):
        return "critical"
    if ratio >= WARN_RATIO:
        return "warning"
    return "ok"


def _normalize_code(code: str) -> str:
    return (code or "").strip()


def lookup_last_upkeep(items: dict[str, datetime], code: str) -> datetime | None:
    key = _normalize_code(code)
    if not key:
        return None
    direct = items.get(key)
    if direct is not None:
        return direct
    lower = key.lower()
    for k, v in items.items():
        if k.lower() == lower:
            return v
    return None


def is_manual_equipment_status(status: str | None, label_by_value: dict[str, str] | None = None) -> bool:
    key = (status or "").strip().lower()
    if not key:
        return False
    if key in MANUAL_EQUIPMENT_STATUS:
        return True
    label = ((label_by_value or {}).get(key) or "").strip()
    return "保养" in label


def equipment_has_cycle(cycle_yield: Any, cycle_days: Any) -> bool:
    cy = _parse_dec(cycle_yield)
    cd = _parse_positive_int(cycle_days)
    return (cy is not None and cy > 0) or cd is not None


def equipment_needs_tracking(
    *,
    used_yield: Any,
    operational_status: str | None,
) -> bool:
    uy = _parse_dec(used_yield)
    if uy is not None and uy > 0:
        return True
    st = (operational_status or "").strip().lower()
    return st in {"running", "repair", "standby", "upkeep", "maintenance", "保养"}


def mold_has_cycle(cycle_yield: Any) -> bool:
    cy = _parse_dec(cycle_yield)
    return cy is not None and cy > 0


def mold_needs_tracking(*, used_yield: Any, total_manufacture_qty: Any, status: str | None) -> bool:
    uy = _parse_dec(used_yield)
    if uy is not None and uy > 0:
        return True
    tq = _parse_dec(total_manufacture_qty)
    if tq is not None and tq > 0:
        return True
    st = (status or "").strip()
    return st in MOLD_IN_USE_STATUSES


@dataclass
class EquipmentReminderEval:
    alert_level: AlertLevel
    alert_reasons: list[str] = field(default_factory=list)
    reminder_kind: EquipmentReminderKind = "cycle_plan"
    dominant_dimension: EquipmentDimension | None = None
    dominant_ratio: float = 0.0
    last_upkeep_at: str | None = None
    days_since_upkeep: int | None = None
    yield_usage_pct: float | None = None
    days_usage_pct: float | None = None
    remaining_days: int | None = None


@dataclass
class MoldReminderEval:
    alert_level: AlertLevel
    alert_reasons: list[str] = field(default_factory=list)
    reminder_kind: MoldReminderKind = "cycle_plan"
    dominant_dimension: MoldDimension | None = None
    dominant_ratio: float = 0.0
    last_upkeep_at: str | None = None
    yield_usage_pct: float | None = None
    total_yield_usage_pct: float | None = None
    remaining_yield_pct: float | None = None


def _iso_dt(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return to_api_isoformat(dt)


def _days_since(last_upkeep: datetime) -> int:
    now = datetime.now(timezone.utc)
    lu = last_upkeep if last_upkeep.tzinfo else last_upkeep.replace(tzinfo=timezone.utc)
    return (now.date() - lu.date()).days


def evaluate_equipment_reminder(
    *,
    asset_code: str,
    operational_status: str | None,
    maintenance_cycle_by_yield: Any,
    maintenance_cycle_by_days: Any,
    used_yield: Any,
    last_upkeep_by_equipment: dict[str, datetime],
    label_by_value: dict[str, str] | None = None,
) -> EquipmentReminderEval | None:
    code = _normalize_code(asset_code)
    if not code:
        return None

    if is_manual_equipment_status(operational_status, label_by_value):
        return EquipmentReminderEval(
            alert_level="warning",
            alert_reasons=["设备运行状态为保养，请安排保养作业"],
            reminder_kind="manual_maintenance",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=None,
        )

    has_cycle = equipment_has_cycle(maintenance_cycle_by_yield, maintenance_cycle_by_days)
    last_upkeep = lookup_last_upkeep(last_upkeep_by_equipment, code)

    if not has_cycle:
        if not equipment_needs_tracking(used_yield=used_yield, operational_status=operational_status):
            return None
        return EquipmentReminderEval(
            alert_level="warning",
            alert_reasons=["未配置保养周期（依产量或依天数），请维护设备台账"],
            reminder_kind="setup_no_cycle",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=_iso_dt(last_upkeep),
        )

    if last_upkeep is None:
        return EquipmentReminderEval(
            alert_level="warning",
            alert_reasons=["已配置保养周期，但尚无保养完修记录，请完成首次保养并登记完修单"],
            reminder_kind="setup_no_baseline",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=None,
        )

    cycle_y = _parse_dec(maintenance_cycle_by_yield)
    used_y = _parse_dec(used_yield) or Decimal("0")
    cycle_d = _parse_positive_int(maintenance_cycle_by_days)
    last_iso = _iso_dt(last_upkeep)
    days = _days_since(last_upkeep)

    candidates: list[tuple[EquipmentDimension, Decimal, float | None, int | None, float | None]] = []

    if cycle_y is not None and cycle_y > 0 and used_y > 0:
        ratio = used_y / cycle_y
        candidates.append(
            (
                "yield",
                ratio,
                float(round(ratio * Decimal("1000")) / 10),
                None,
                None,
            )
        )

    if cycle_d is not None:
        ratio = Decimal(days) / Decimal(cycle_d)
        days_pct = float(round(ratio * Decimal("1000")) / 10)
        remaining = max(0, cycle_d - days)
        candidates.append(("days", ratio, None, days, days_pct))

    if not candidates:
        return EquipmentReminderEval(
            alert_level="ok",
            alert_reasons=[],
            reminder_kind="cycle_plan",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=last_iso,
            days_since_upkeep=days,
        )

    dominant = max(candidates, key=lambda c: c[1])
    dim, ratio, yield_pct, days_since, days_pct = dominant
    alert_level = _level_from_ratio(ratio)

    reasons: list[str] = []
    for c_dim, c_ratio, _, _, _ in candidates:
        lv = _level_from_ratio(c_ratio)
        if lv not in ("critical", "warning"):
            continue
        if c_dim == "yield":
            reasons.append(
                "累计产量已达或超过「依产量」维保周期"
                if lv == "critical"
                else "累计产量已接近「依产量」维保周期（≥90%）"
            )
        else:
            reasons.append(
                "距上次保养已超过「依天数」维保周期"
                if lv == "critical"
                else "距上次保养已接近「依天数」维保周期（≥90%）"
            )

    remaining_days = None
    if cycle_d is not None:
        remaining_days = max(0, cycle_d - days)

    yield_cand = next((c for c in candidates if c[0] == "yield"), None)
    days_cand = next((c for c in candidates if c[0] == "days"), None)

    return EquipmentReminderEval(
        alert_level=alert_level,
        alert_reasons=reasons,
        reminder_kind="cycle_plan",
        dominant_dimension=dim,
        dominant_ratio=float(ratio),
        last_upkeep_at=last_iso,
        days_since_upkeep=days_cand[3] if days_cand else days,
        yield_usage_pct=yield_cand[2] if yield_cand else None,
        days_usage_pct=days_cand[4] if days_cand else None,
        remaining_days=remaining_days if dim == "days" else remaining_days,
    )


def evaluate_mold_reminder(
    *,
    mold_code: str,
    status: str | None,
    maintenance_cycle_by_yield: Any,
    used_yield: Any,
    total_manufacture_qty: Any,
    usable_yield: Any,
    last_upkeep_by_mold: dict[str, datetime],
) -> MoldReminderEval | None:
    code = _normalize_code(mold_code)
    if not code:
        return None

    if (status or "").strip() == "保养":
        return MoldReminderEval(
            alert_level="warning",
            alert_reasons=["模具台账状态为保养，请安排保养作业"],
            reminder_kind="manual_maintenance",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=None,
        )

    has_cycle = mold_has_cycle(maintenance_cycle_by_yield)
    last_upkeep = lookup_last_upkeep(last_upkeep_by_mold, code)

    if not has_cycle:
        if not mold_needs_tracking(
            used_yield=used_yield,
            total_manufacture_qty=total_manufacture_qty,
            status=status,
        ):
            return None
        return MoldReminderEval(
            alert_level="warning",
            alert_reasons=["未配置保养周期（依产量），请维护模具台账"],
            reminder_kind="setup_no_cycle",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=_iso_dt(last_upkeep),
        )

    if last_upkeep is None:
        return MoldReminderEval(
            alert_level="warning",
            alert_reasons=["已配置保养周期，但尚无保养完修记录，请完成首次保养并登记完修单"],
            reminder_kind="setup_no_baseline",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=None,
        )

    cycle_y = _parse_dec(maintenance_cycle_by_yield)
    assert cycle_y is not None and cycle_y > 0
    used_y = _parse_dec(used_yield) or Decimal("0")
    total_q = _parse_dec(total_manufacture_qty) or Decimal("0")
    last_iso = _iso_dt(last_upkeep)

    candidates: list[tuple[MoldDimension, Decimal, float]] = []
    if used_y > 0:
        ratio_y = used_y / cycle_y
        candidates.append(("yield", ratio_y, float(round(ratio_y * Decimal("1000")) / 10)))
    if total_q > 0:
        ratio_t = total_q / cycle_y
        candidates.append(("yield_total", ratio_t, float(round(ratio_t * Decimal("1000")) / 10)))

    if not candidates:
        return MoldReminderEval(
            alert_level="ok",
            alert_reasons=[],
            reminder_kind="cycle_plan",
            dominant_dimension=None,
            dominant_ratio=0.0,
            last_upkeep_at=last_iso,
        )

    dominant = max(candidates, key=lambda c: c[1])
    dim, ratio, pct = dominant
    alert_level = _level_from_ratio(ratio)

    reasons: list[str] = []
    for c_dim, c_ratio, _ in candidates:
        lv = _level_from_ratio(c_ratio)
        if lv not in ("critical", "warning"):
            continue
        if c_dim == "yield":
            reasons.append(
                "已用产量已达或超过保养周期"
                if lv == "critical"
                else "已用产量已接近保养周期（≥90%）"
            )
        else:
            reasons.append(
                "总制造数量已达或超过保养周期"
                if lv == "critical"
                else "总制造数量已接近保养周期（≥90%）"
            )

    rated = _parse_dec(usable_yield)
    remaining_yield_pct = None
    if rated is not None and rated > 0:
        remaining = max(Decimal("0"), rated - used_y)
        remaining_yield_pct = float(round((remaining / rated) * Decimal("1000")) / 10)
        if remaining_yield_pct <= 10:
            reasons.append(f"额定可用产量余量仅约 {remaining_yield_pct}%（已用 {used_y} / 额定 {rated}）")

    yield_cand = next((c for c in candidates if c[0] == "yield"), None)
    total_cand = next((c for c in candidates if c[0] == "yield_total"), None)

    return MoldReminderEval(
        alert_level=alert_level,
        alert_reasons=reasons,
        reminder_kind="cycle_plan",
        dominant_dimension=dim,
        dominant_ratio=float(ratio),
        last_upkeep_at=last_iso,
        yield_usage_pct=yield_cand[2] if yield_cand else None,
        total_yield_usage_pct=total_cand[2] if total_cand else None,
        remaining_yield_pct=remaining_yield_pct,
    )


def is_actionable_equipment(eval_row: EquipmentReminderEval) -> bool:
    if eval_row.reminder_kind in ("manual_maintenance", "setup_no_cycle", "setup_no_baseline"):
        return True
    return eval_row.alert_level in ("warning", "critical")


def is_actionable_mold(eval_row: MoldReminderEval) -> bool:
    if eval_row.reminder_kind in ("manual_maintenance", "setup_no_cycle", "setup_no_baseline"):
        return True
    return eval_row.alert_level in ("warning", "critical")


SEVERITY_RANK = {"critical": 0, "warning": 1, "ok": 2}
KIND_RANK = {
    "manual_maintenance": 0,
    "setup_no_baseline": 1,
    "setup_no_cycle": 2,
    "cycle_plan": 3,
}


def equipment_sort_key(eval_row: EquipmentReminderEval, asset_code: str) -> tuple:
    kind = eval_row.reminder_kind
    return (
        KIND_RANK.get(kind, 9),
        SEVERITY_RANK[eval_row.alert_level],
        -eval_row.dominant_ratio,
        asset_code,
    )


def mold_sort_key(eval_row: MoldReminderEval, mold_code: str) -> tuple:
    kind = eval_row.reminder_kind
    return (
        KIND_RANK.get(kind, 9),
        SEVERITY_RANK[eval_row.alert_level],
        -eval_row.dominant_ratio,
        mold_code,
    )


def passes_severity_filter(
    *,
    reminder_kind: str,
    alert_level: str,
    severity_min: str | None,
) -> bool:
    if reminder_kind in ("manual_maintenance", "setup_no_cycle", "setup_no_baseline"):
        if not severity_min or severity_min == "all":
            return True
        if severity_min == "critical":
            return False
        return True
    if not severity_min or severity_min == "all":
        return True
    if severity_min == "critical":
        return alert_level == "critical"
    if severity_min == "warning":
        return alert_level in ("critical", "warning")
    return True
