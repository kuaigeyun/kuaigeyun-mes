"""仓储先进先出（FIFO/FEFO）判定策略。"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Iterable, Optional, Tuple

FIFO_MODE_BATCH_ID = "batch_id"
FIFO_MODE_PRODUCTION_DATE = "production_date"
FIFO_MODE_EXPIRY_DATE = "expiry_date"

ALLOWED_FIFO_MODES = {
    FIFO_MODE_BATCH_ID,
    FIFO_MODE_PRODUCTION_DATE,
    FIFO_MODE_EXPIRY_DATE,
}


def normalize_fifo_mode(raw: Any) -> str:
    mode = str(raw or FIFO_MODE_BATCH_ID).strip().lower()
    if mode not in ALLOWED_FIFO_MODES:
        return FIFO_MODE_BATCH_ID
    return mode


def resolve_fifo_settings(biz_config: Optional[Dict[str, Any]]) -> Tuple[bool, str]:
    """从业务配置解析 (enforce_fifo, fifo_mode)。"""
    wh = ((biz_config or {}).get("parameters") or {}).get("warehouse") or {}
    enforce = bool(wh.get("fifo", False))
    mode = normalize_fifo_mode(wh.get("fifo_mode"))
    return enforce, mode


def batch_fifo_sort_key(batch: Any, fifo_mode: str) -> Tuple:
    """
    越小越应先出。
    - batch_id: id
    - production_date: 生产日期升序（空视为最早），再 id
    - expiry_date: 有效期升序（空视为最晚，先出有期批次），再 id
    """
    mode = normalize_fifo_mode(fifo_mode)
    bid = int(getattr(batch, "id", 0) or 0)
    if mode == FIFO_MODE_PRODUCTION_DATE:
        pd = getattr(batch, "production_date", None)
        return (pd is not None, pd or date.min, bid)
    if mode == FIFO_MODE_EXPIRY_DATE:
        ed = getattr(batch, "expiry_date", None)
        # 有有效期的优先按日期；无有效期排后面
        return (ed is None, ed or date.max, bid)
    return (bid,)


def is_batch_before(candidate: Any, current: Any, fifo_mode: str) -> bool:
    return batch_fifo_sort_key(candidate, fifo_mode) < batch_fifo_sort_key(current, fifo_mode)


def pick_blocking_older_batch(
    current: Any, siblings: Iterable[Any], fifo_mode: str
) -> Optional[Any]:
    """返回应优先于 current 且仍有库存的批次（若存在）。"""
    for other in siblings:
        if int(getattr(other, "id", 0) or 0) == int(getattr(current, "id", 0) or 0):
            continue
        qty = getattr(other, "quantity", 0) or 0
        if qty <= 0:
            continue
        if is_batch_before(other, current, fifo_mode):
            return other
    return None


def sort_batches_for_fifo(batches: Iterable[Any], fifo_mode: str) -> list:
    return sorted(list(batches), key=lambda b: batch_fifo_sort_key(b, fifo_mode))


def fifo_mode_label(fifo_mode: str) -> str:
    mode = normalize_fifo_mode(fifo_mode)
    return {
        FIFO_MODE_BATCH_ID: "批次建档顺序",
        FIFO_MODE_PRODUCTION_DATE: "生产日期",
        FIFO_MODE_EXPIRY_DATE: "有效期(FEFO)",
    }.get(mode, mode)
