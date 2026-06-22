"""好力 GO — 路线巡检行状态。"""

from __future__ import annotations

from typing import Any

ROUTE_PATROL_LINE_STATUS_NORMAL = "normal"
ROUTE_PATROL_LINE_STATUS_ABNORMAL = "abnormal"
ROUTE_PATROL_LINE_STATUS_NOT_PRODUCING = "not_producing"

ROUTE_PATROL_LINE_STATUSES = frozenset(
    {
        ROUTE_PATROL_LINE_STATUS_NORMAL,
        ROUTE_PATROL_LINE_STATUS_ABNORMAL,
        ROUTE_PATROL_LINE_STATUS_NOT_PRODUCING,
    }
)


def normalize_route_patrol_line_status(value: Any, *, default: str = ROUTE_PATROL_LINE_STATUS_NORMAL) -> str:
    raw = str(value or "").strip().lower()
    if raw in ROUTE_PATROL_LINE_STATUSES:
        return raw
    if raw in {"true", "1", "yes"}:
        return ROUTE_PATROL_LINE_STATUS_NORMAL
    if raw in {"false", "0", "no"}:
        return ROUTE_PATROL_LINE_STATUS_ABNORMAL
    return default


def is_route_patrol_line_abnormal(status: str | None) -> bool:
    return normalize_route_patrol_line_status(status) == ROUTE_PATROL_LINE_STATUS_ABNORMAL
