"""生产领料过账口径：正式发料 (GI) vs 线边备料转移（主仓→线边）。

线边备料单 / 补料申请 = 仅备料转移，不算工单耗用。
生产领料单确认 = 正式发料（扣减所选仓库库存），须回写明细已领数量。
历史补料曾误生成「已领料」领料单并做转移；靠备注识别并排除出 GI/齐套「已领」累计。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable, List, Optional, Sequence

from apps.kuaizhizao.utils.mrp_quantity import MRP_QTY_STEP, mrp_qty

# 防超发容差：允许在 BOM 上限基础上略超 1%（与历史口径一致，但用 Decimal 计算）
OVERPICK_TOLERANCE_RATIO = Decimal("1.01")

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


def exceeds_work_order_pick_limit(total_attempt: Decimal, allowed: Decimal) -> bool:
    """
    工单领料是否超出 BOM 配方上限（含 1% 容差）。

    全程 Decimal + mrp_qty，避免 float(0.29) * 1.01 与 0.29 比较误拦。
    """
    total = mrp_qty(total_attempt)
    limit = mrp_qty(allowed)
    if limit <= 0:
        return total > 0
    cap = mrp_qty(limit * OVERPICK_TOLERANCE_RATIO)
    if total <= cap:
        return False
    # 超出容差但在 1 个数量步长内：视为显示精度内相等，不拦截
    if total - cap <= MRP_QTY_STEP:
        return False
    return True


def format_pick_limit_qty(value: Decimal) -> str:
    """防超发提示数量：去尾零，最多四位小数。"""
    q = mrp_qty(value)
    text = format(q, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"
