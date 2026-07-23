"""生产领料过账口径：正式发料 (GI) vs 备料转移（主仓→线边）。

配料单 / 叫料 = 仅备料转移，不算工单耗用。
领料单确认 = 正式发料（扣减所选仓库库存），须回写明细已领数量。
历史叫料曾误生成「已领料」领料单并做转移；靠备注识别并排除出 GI/齐套「已领」累计。
"""

from __future__ import annotations

from typing import Iterable, List, Optional, Sequence

# 历史叫料完成自动生成领料单的备注特征（主仓→线边转移，非正式发料）
_STAGING_PICKING_NOTE_MARKERS = (
    "主仓→线边",
    "叫料单",
)


def is_staging_transfer_picking_notes(notes: Optional[str]) -> bool:
    text = (notes or "").strip()
    if not text:
        return False
    return any(marker in text for marker in _STAGING_PICKING_NOTE_MARKERS)


def filter_gi_picking_ids(
    pickings: Sequence[object],
) -> List[int]:
    """从领料单列表中筛出正式发料单 ID（排除备料转移型历史单据）。"""
    result: List[int] = []
    for p in pickings:
        pid = getattr(p, "id", None)
        if pid is None:
            continue
        if is_staging_transfer_picking_notes(getattr(p, "notes", None)):
            continue
        result.append(int(pid))
    return result


def exclude_staging_picking_ids(
    picking_ids: Iterable[int],
    staging_ids: Iterable[int],
) -> List[int]:
    staging = {int(x) for x in staging_ids}
    return [int(x) for x in picking_ids if int(x) not in staging]
