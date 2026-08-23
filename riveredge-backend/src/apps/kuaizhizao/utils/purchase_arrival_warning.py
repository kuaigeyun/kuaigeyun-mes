"""采购到货预警等级计算（行级 required_date + 未收数量，站点日历日）。"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional

from apps.kuaizhizao.models.purchase_order import effective_po_item_outstanding

WARNING_LEVEL_NORMAL = "normal"
WARNING_LEVEL_IMMINENT = "imminent"
WARNING_LEVEL_OVERDUE = "overdue"

DEFAULT_ARRIVAL_IMMINENT_DAYS = 3

# 不参与预警的采购订单主状态
PO_TERMINAL_STATUSES = frozenset({
    "DRAFT", "草稿", "draft",
    "CANCELLED", "已取消", "cancelled",
    "REJECTED", "已驳回", "rejected",
    "COMPLETED", "已完成", "completed",
    "CLOSED", "已关闭", "closed",
    "CLOSE", "关闭",
})


def compute_warning_level(
    required_date: Optional[date],
    site_today: date,
    *,
    imminent_days: int = DEFAULT_ARRIVAL_IMMINENT_DAYS,
    has_open_qty: bool = True,
) -> Optional[str]:
    """未关闭行返回 normal/imminent/overdue；无计划日或无未收量返回 None。"""
    if not has_open_qty or required_date is None:
        return None
    if required_date < site_today:
        return WARNING_LEVEL_OVERDUE
    if required_date <= site_today + timedelta(days=max(0, int(imminent_days))):
        return WARNING_LEVEL_IMMINENT
    return WARNING_LEVEL_NORMAL


def compute_day_offset(required_date: Optional[date], site_today: date) -> int:
    """正数=剩余天数，负数=超期天数，0=当天。"""
    if required_date is None:
        return 0
    return (required_date - site_today).days


def line_has_open_receipt(item: Any) -> bool:
    outstanding = getattr(item, "outstanding_quantity", None)
    if outstanding is not None:
        try:
            return Decimal(str(outstanding)) > 0
        except Exception:
            pass
    return effective_po_item_outstanding(item) > 0


def po_status_excluded(status: Optional[str]) -> bool:
    return normalize_po_status(status) in PO_TERMINAL_STATUSES


def normalize_po_status(status: Optional[str]) -> str:
    return str(status or "").strip()


def enrich_line_warning_fields(
    row: dict,
    *,
    site_today: date,
    imminent_days: int,
) -> dict:
    """为行 dict 写入 warning_level / remaining_days / overdue_days / day_offset。"""
    dd = row.get("required_date")
    if hasattr(dd, "date"):
        dd = dd.date() if callable(getattr(dd, "date", None)) else dd
    pending = float(row.get("outstanding_quantity") or 0)
    has_open = pending > 0
    level = compute_warning_level(dd, site_today, imminent_days=imminent_days, has_open_qty=has_open)
    offset = compute_day_offset(dd, site_today) if dd is not None else 0
    row["warning_level"] = level
    row["day_offset"] = offset
    row["remaining_days"] = offset if offset > 0 else 0
    row["overdue_days"] = abs(offset) if offset < 0 else 0
    row["is_overdue"] = level == WARNING_LEVEL_OVERDUE
    return row
