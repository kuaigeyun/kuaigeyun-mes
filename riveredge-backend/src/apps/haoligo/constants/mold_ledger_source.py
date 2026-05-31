"""好力 GO — 模具台账来源（同步 / 手工创建）。"""

from __future__ import annotations

MOLD_LEDGER_SOURCE_SYNC = "sync"
MOLD_LEDGER_SOURCE_MANUAL = "manual"

MOLD_LEDGER_SOURCE_VALUES: tuple[str, ...] = (
    MOLD_LEDGER_SOURCE_SYNC,
    MOLD_LEDGER_SOURCE_MANUAL,
)

MOLD_LEDGER_SOURCE_SET: frozenset[str] = frozenset(MOLD_LEDGER_SOURCE_VALUES)

MOLD_LEDGER_SOURCE_LABELS: dict[str, str] = {
    MOLD_LEDGER_SOURCE_SYNC: "同步",
    MOLD_LEDGER_SOURCE_MANUAL: "手工创建",
}


def ledger_source_filter_q(source: str):
    """列表筛选：sync 精确匹配；manual 含 NULL（历史数据曾将 manual 置空）。"""
    from tortoise.expressions import Q

    src = (source or "").strip()
    if src == MOLD_LEDGER_SOURCE_SYNC:
        return Q(ledger_source=MOLD_LEDGER_SOURCE_SYNC)
    if src == MOLD_LEDGER_SOURCE_MANUAL:
        return Q(ledger_source=MOLD_LEDGER_SOURCE_MANUAL) | Q(ledger_source__isnull=True)
    return Q(ledger_source=src)
