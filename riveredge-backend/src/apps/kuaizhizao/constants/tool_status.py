"""快格轻制造 — 工装台账状态常量。"""

from __future__ import annotations

TOOL_STATUS_PENDING_ACTIVATION = "待启用"
TOOL_STATUS_IDLE = "待用"
TOOL_STATUS_IN_USE = "在用"
TOOL_STATUS_MAINTENANCE = "保养中"
TOOL_STATUS_REPAIR = "维修中"
TOOL_STATUS_CALIBRATION = "校验中"
TOOL_STATUS_SCRAPPED = "报废"
TOOL_STATUS_DISABLED = "停用"

TOOL_STATUS_VALUES: tuple[str, ...] = (
    TOOL_STATUS_PENDING_ACTIVATION,
    TOOL_STATUS_IDLE,
    TOOL_STATUS_IN_USE,
    TOOL_STATUS_MAINTENANCE,
    TOOL_STATUS_REPAIR,
    TOOL_STATUS_CALIBRATION,
    TOOL_STATUS_SCRAPPED,
    TOOL_STATUS_DISABLED,
)

TOOL_STATUS_SET: frozenset[str] = frozenset(TOOL_STATUS_VALUES)

MANUAL_LOCK_STATUSES: frozenset[str] = frozenset({
    TOOL_STATUS_SCRAPPED,
    TOOL_STATUS_DISABLED,
})

LEGACY_STATUS_MAP: dict[str, str] = {
    "正常": TOOL_STATUS_IDLE,
    "领用中": TOOL_STATUS_IN_USE,
}

OPEN_MAINTENANCE_STATUSES: frozenset[str] = frozenset({"已审核", "进行中"})
OPEN_REPAIR_STATUSES: frozenset[str] = frozenset({"已审核", "进行中"})
OPEN_CALIBRATION_STATUSES: frozenset[str] = frozenset({"进行中"})
OUTSTANDING_BORROW_STATUS = "领用中"


def normalize_tool_status(status: str | None) -> str:
    """将历史状态值映射为当前允许值。"""
    if not status:
        return TOOL_STATUS_PENDING_ACTIVATION
    return LEGACY_STATUS_MAP.get(status, status)


def validate_tool_status(status: str) -> str:
    normalized = normalize_tool_status(status)
    if normalized not in TOOL_STATUS_SET:
        allowed = ", ".join(TOOL_STATUS_VALUES)
        raise ValueError(f"工装状态必须是以下之一: {allowed}")
    return normalized
