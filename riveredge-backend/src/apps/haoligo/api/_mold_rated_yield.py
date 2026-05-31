"""模具台账：额定可用产量 = 单模产能 × 额定可用次数。"""

from __future__ import annotations

from decimal import Decimal


def derive_usable_yield(mold_capacity: Decimal, usable_times: int | None) -> Decimal | None:
    if usable_times is None:
        return None
    if usable_times <= 0:
        return Decimal("0")
    return mold_capacity * Decimal(usable_times)


def resolve_usable_yield(
    mold_capacity: Decimal,
    usable_times: int | None,
    explicit: Decimal | None,
) -> Decimal | None:
    """优先使用请求体中的额定可用产量；未传时按单模产能×额定可用次数推算。"""
    if explicit is not None:
        return explicit
    return derive_usable_yield(mold_capacity, usable_times)
