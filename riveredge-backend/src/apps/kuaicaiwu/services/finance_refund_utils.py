"""收/付款退款执行态计算（写路径唯一真源）。"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import List, Optional, Sequence, Tuple

REFUND_STATUS_NONE = "未退款"
REFUND_STATUS_PARTIAL = "部分退款"
REFUND_STATUS_FULL = "全部退款"

_MONEY = Decimal("0.01")
_ALLOC_KEY = "allocated_amount"


def quantize_money(value: Decimal | float | str) -> Decimal:
    return Decimal(str(value or 0)).quantize(_MONEY)


def compute_refund_execution_status(total_amount: Decimal, refunded_amount: Decimal) -> str:
    total = quantize_money(total_amount)
    refunded = quantize_money(refunded_amount)
    if refunded <= Decimal("0"):
        return REFUND_STATUS_NONE
    if refunded >= total:
        return REFUND_STATUS_FULL
    return REFUND_STATUS_PARTIAL


def compute_refundable_balance(
    total_amount: Decimal,
    refunded_amount: Decimal,
    reserved_refund_amount: Decimal = Decimal("0"),
) -> Decimal:
    total = quantize_money(total_amount)
    refunded = quantize_money(refunded_amount)
    reserved = quantize_money(reserved_refund_amount)
    return max(Decimal("0"), total - refunded - reserved)


def encode_refund_allocation_notes(amount: Decimal) -> str:
    return json.dumps({_ALLOC_KEY: str(quantize_money(amount))}, ensure_ascii=False)


def parse_refund_allocation_notes(notes: Optional[str]) -> Optional[Decimal]:
    raw = (notes or "").strip()
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or _ALLOC_KEY not in payload:
        return None
    return quantize_money(payload[_ALLOC_KEY])


def allocate_refund_across_sources(
    source_caps: Sequence[Tuple[int, Decimal]],
    total_amount: Decimal,
) -> List[Tuple[int, Decimal]]:
    """
    按源单顺序（调用方已排好）贪心分摊退款金额，每单不超过其可退余额。
    source_caps: [(source_id, max_refundable), ...]
    """
    total = quantize_money(total_amount)
    if total <= 0:
        raise ValueError("退款金额须大于 0")
    cap_sum = quantize_money(sum((cap for _, cap in source_caps), Decimal("0")))
    if total > cap_sum:
        raise ValueError(f"退款金额 {total} 超过可退合计 {cap_sum}")
    remaining = total
    result: List[Tuple[int, Decimal]] = []
    for source_id, cap in source_caps:
        if remaining <= 0:
            break
        chunk = min(quantize_money(cap), remaining)
        if chunk <= 0:
            continue
        result.append((int(source_id), chunk))
        remaining = quantize_money(remaining - chunk)
    if remaining > 0:
        raise ValueError("退款金额分摊失败，仍有未分配余额")
    return result
