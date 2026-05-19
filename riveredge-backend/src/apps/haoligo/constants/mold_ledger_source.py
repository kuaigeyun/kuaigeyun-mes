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
