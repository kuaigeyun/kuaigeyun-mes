"""
合并开票：源单分摊金额落在 DocumentRelation.notes，汇总时按源单归因。

单源加载：无分摊字段时整票价税合计记入该源单。
多源合并：须写入 allocated_amount；缺省时按源单总额比例分摊（兼容历史数据）。
"""

from __future__ import annotations

import json
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

_TWOPLACES = Decimal("0.01")
_ALLOCATED_AMOUNT_KEY = "allocated_amount"


def _q(value: Decimal | str | int | float | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def encode_relation_allocated_amount(amount: Decimal) -> str:
    return json.dumps(
        {_ALLOCATED_AMOUNT_KEY: str(_q(amount))},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def parse_relation_allocated_amount(notes: Optional[str]) -> Optional[Decimal]:
    raw = (notes or "").strip()
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or _ALLOCATED_AMOUNT_KEY not in data:
        return None
    return _q(data.get(_ALLOCATED_AMOUNT_KEY))


def attribute_invoice_total_to_sources(
    invoice_total: Decimal,
    source_entries: Sequence[Tuple[int, Optional[Decimal]]],
    source_document_totals: Dict[int, Decimal],
) -> Dict[int, Decimal]:
    """
    将一张发票的价税合计归因到多个源单。

    source_entries: (source_id, explicit_allocated_or_None)
    """
    total = _q(invoice_total)
    if total <= 0 or not source_entries:
        return {}

    if len(source_entries) == 1:
        sid, explicit = source_entries[0]
        return {int(sid): _q(explicit) if explicit is not None else total}

    if all(explicit is not None for _, explicit in source_entries):
        return {int(sid): _q(explicit) for sid, explicit in source_entries}

    weights: List[Tuple[int, Decimal]] = []
    for sid, _explicit in source_entries:
        w = _q(source_document_totals.get(int(sid), Decimal("0")))
        if w <= 0:
            w = _TWOPLACES
        weights.append((int(sid), w))
    weight_sum = sum((w for _, w in weights), Decimal("0"))
    if weight_sum <= 0:
        equal = _q(total / Decimal(len(weights)))
        out = {sid: equal for sid, _ in weights}
        # 尾差贴到最后一笔
        drift = total - sum(out.values(), Decimal("0"))
        last_sid = weights[-1][0]
        out[last_sid] = _q(out[last_sid] + drift)
        return out

    out: Dict[int, Decimal] = {}
    assigned = Decimal("0")
    for idx, (sid, w) in enumerate(weights):
        if idx == len(weights) - 1:
            out[sid] = _q(total - assigned)
        else:
            part = _q(total * w / weight_sum)
            out[sid] = part
            assigned += part
    return out


def accumulate_attributed(
    result: Dict[int, Decimal],
    attributed: Iterable[Tuple[int, Decimal]],
) -> None:
    for sid, amount in attributed:
        if sid not in result:
            continue
        result[sid] = _q(result.get(sid, Decimal("0")) + amount)
