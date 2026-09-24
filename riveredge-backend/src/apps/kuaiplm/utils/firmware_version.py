"""产品固件 INF-05 策略行映射（R-15 #28 / R-01 文控入口）。"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Set

_FILE_UUID_RE = re.compile(r"^[0-9a-f-]{36}$", re.I)


def is_firmware_file_uuid(value: Optional[str]) -> bool:
    return bool(value and _FILE_UUID_RE.match(str(value).strip()))


def bump_firmware_version(current: str) -> str:
    """固件版本号递增（V1.01→V1.02；A0→A1；其余追加 .1）。"""
    raw = (current or "V1.00").strip() or "V1.00"
    dotted = re.match(r"^([Vv])(\d+)\.(\d+)$", raw)
    if dotted:
        minor = int(dotted.group(3)) + 1
        width = len(dotted.group(3))
        return f"V{dotted.group(2)}.{minor:0{width}d}"
    alpha_num = re.match(r"^([A-Za-z]+)(\d+)$", raw)
    if alpha_num:
        return f"{alpha_num.group(1)}{int(alpha_num.group(2)) + 1}"
    return f"{raw}.1"


def firmware_policy_status(business_status: str) -> str:
    """业务状态 → INF-05 status（rejected 永不出现；未发布不进正式有效）。"""
    st = (business_status or "").strip().lower()
    if st == "obsolete":
        return "obsolete"
    if st == "released":
        return "effective"
    # draft / pending / approved：使用方不可见，制定方可见自己的
    return "draft"


def firmware_policy_row(
    row: Any,
    *,
    latest_released_ids: Optional[Set[int]] = None,
) -> Dict[str, Any]:
    latest = latest_released_ids or set()
    st = str(getattr(row, "status", "") or "")
    is_released = st == "released"
    is_latest = bool(is_released and getattr(row, "id", None) in latest)
    return {
        "id": getattr(row, "id", None),
        "project_id": getattr(row, "project_id", None),
        "version": getattr(row, "version", None),
        "status": firmware_policy_status(st),
        # 仅「当前最新已发布」视为生效，避免遗留多 released 被使用方看见
        "is_effective": is_latest,
        "is_latest_effective": is_latest,
        "is_production_effective": is_latest,
        "created_by": getattr(row, "created_by", None),
    }
