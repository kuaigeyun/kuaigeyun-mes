"""合并开票分摊修复与汇总逻辑测试。"""

from decimal import Decimal

from apps.kuaicaiwu.services.invoice_merge_allocation_repair import _resolve_allocations
from apps.kuaicaiwu.services.invoice_source_allocation import (
    attribute_invoice_total_to_sources,
)


def test_resolve_allocations_proportional_merge_case():
    """YS200 + YS6000 合并开 ¥6200 应分摊为 200 / 6000。"""
    doc_totals = {1: Decimal("200"), 2: Decimal("6000")}
    out = _resolve_allocations(
        Decimal("6200"),
        [1, 2],
        doc_totals,
        explicit_by_source={1: None, 2: None},
    )
    assert out[1] == Decimal("200.00")
    assert out[2] == Decimal("6000.00")


def test_resolve_allocations_keeps_explicit_per_source():
    out = _resolve_allocations(
        Decimal("1000"),
        [1, 2],
        {1: Decimal("600"), 2: Decimal("400")},
        explicit_by_source={1: Decimal("600"), 2: Decimal("400")},
    )
    assert out[1] == Decimal("600.00")
    assert out[2] == Decimal("400.00")


def test_attribute_matches_repair_helper_for_legacy():
    legacy = attribute_invoice_total_to_sources(
        Decimal("6200"),
        [(1, None), (2, None)],
        {1: Decimal("200"), 2: Decimal("6000")},
    )
    repaired = _resolve_allocations(
        Decimal("6200"),
        [1, 2],
        {1: Decimal("200"), 2: Decimal("6000")},
        {1: None, 2: None},
    )
    assert legacy == repaired
