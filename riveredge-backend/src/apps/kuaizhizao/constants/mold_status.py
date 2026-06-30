"""快格轻制造 — 模具台账状态常量。"""

from __future__ import annotations

MOLD_STATUS_PENDING_ACTIVATION = "待启用"
MOLD_STATUS_IDLE = "待用"
MOLD_STATUS_IN_USE = "在用"
MOLD_STATUS_TRIAL = "试模中"
MOLD_STATUS_MAINTENANCE = "保养中"
MOLD_STATUS_REPAIR = "维修中"
MOLD_STATUS_CALIBRATION = "校验中"
MOLD_STATUS_SCRAPPED = "报废"
MOLD_STATUS_DISABLED = "停用"

MOLD_STATUS_VALUES: tuple[str, ...] = (
    MOLD_STATUS_PENDING_ACTIVATION,
    MOLD_STATUS_IDLE,
    MOLD_STATUS_IN_USE,
    MOLD_STATUS_TRIAL,
    MOLD_STATUS_MAINTENANCE,
    MOLD_STATUS_REPAIR,
    MOLD_STATUS_CALIBRATION,
    MOLD_STATUS_SCRAPPED,
    MOLD_STATUS_DISABLED,
)

MOLD_STATUS_SET: frozenset[str] = frozenset(MOLD_STATUS_VALUES)

MANUAL_LOCK_STATUSES: frozenset[str] = frozenset({
    MOLD_STATUS_SCRAPPED,
    MOLD_STATUS_DISABLED,
})

LEGACY_STATUS_MAP: dict[str, str] = {
    "正常": MOLD_STATUS_IDLE,
}

OPEN_MAINTENANCE_STATUSES: frozenset[str] = frozenset({"已审核", "进行中"})
OPEN_REPAIR_STATUSES: frozenset[str] = frozenset({"已审核", "进行中"})
OPEN_TRIAL_STATUSES: frozenset[str] = frozenset({"进行中"})
OUTSTANDING_BORROW_STATUS = "领用中"


def normalize_mold_status(status: str | None) -> str:
    """将历史状态值映射为当前允许值。"""
    if not status:
        return MOLD_STATUS_PENDING_ACTIVATION
    return LEGACY_STATUS_MAP.get(status, status)


def validate_mold_status(status: str) -> str:
    normalized = normalize_mold_status(status)
    if normalized not in MOLD_STATUS_SET:
        allowed = ", ".join(MOLD_STATUS_VALUES)
        raise ValueError(f"模具状态必须是以下之一: {allowed}")
    return normalized
