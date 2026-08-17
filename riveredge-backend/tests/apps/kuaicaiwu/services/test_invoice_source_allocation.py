"""分摊归因纯函数测试。"""

from decimal import Decimal

from apps.kuaicaiwu.services.invoice_source_allocation import (
    attribute_invoice_total_to_sources,
    encode_relation_allocated_amount,
    parse_relation_allocated_amount,
)


def test_single_source_uses_full_total():
    out = attribute_invoice_total_to_sources(
        Decimal("1000"),
        [(1, None)],
        {1: Decimal("1000")},
    )
    assert out == {1: Decimal("1000.00")}


def test_multi_explicit_allocations():
    out = attribute_invoice_total_to_sources(
        Decimal("1000"),
        [(1, Decimal("600")), (2, Decimal("400"))],
        {1: Decimal("600"), 2: Decimal("400")},
    )
    assert out[1] == Decimal("600.00")
    assert out[2] == Decimal("400.00")


def test_multi_legacy_proportional():
    out = attribute_invoice_total_to_sources(
        Decimal("1000"),
        [(1, None), (2, None)],
        {1: Decimal("600"), 2: Decimal("400")},
    )
    assert out[1] == Decimal("600.00")
    assert out[2] == Decimal("400.00")


def test_encode_parse_roundtrip():
    notes = encode_relation_allocated_amount(Decimal("123.45"))
    assert parse_relation_allocated_amount(notes) == Decimal("123.45")
    assert parse_relation_allocated_amount("plain text") is None
