"""设备产出单 — 数量精度（默认整数）。"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional


def normalize_equipment_output_qty(value: Any, *, required: bool = False) -> Optional[Decimal]:
    if value is None or value == "":
        return Decimal("0") if required else None
    try:
        d = Decimal(str(value).replace(",", "").strip())
    except Exception:
        if required:
            return Decimal("0")
        return None
    return d.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
