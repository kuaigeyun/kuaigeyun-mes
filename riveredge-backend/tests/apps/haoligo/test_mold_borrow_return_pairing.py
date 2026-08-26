"""模具领用/还入配对：内存配对，禁止按条打库。"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from apps.haoligo.api._mold_processing_time import (
    _outstanding_ids_from_rows,
    pair_return_sheets_to_borrow_sheets,
    parse_borrow_sheet_id_from_ref,
)


def _borrow(**kwargs):
    defaults = {
        "id": 1,
        "mold_code": "M1",
        "created_at": datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc),
        "sheet_no": "LY-1",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _ret(**kwargs):
    defaults = {
        "id": 10,
        "mold_code": "M1",
        "created_at": datetime(2026, 1, 1, 18, 0, tzinfo=timezone.utc),
        "borrow_sheet_no": "领用单#1",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_parse_borrow_sheet_id_from_ref():
    assert parse_borrow_sheet_id_from_ref("领用单#12") == 12
    assert parse_borrow_sheet_id_from_ref("  # 7 ") == 7
    assert parse_borrow_sheet_id_from_ref("88") == 88
    assert parse_borrow_sheet_id_from_ref("LY-1") is None
    assert parse_borrow_sheet_id_from_ref("") is None


def test_pair_by_sheet_no_without_db():
    b1 = _borrow(id=1, sheet_no="LY-1")
    b2 = _borrow(id=2, sheet_no="LY-2", created_at=datetime(2026, 1, 2, 8, 0, tzinfo=timezone.utc))
    r1 = _ret(borrow_sheet_no="LY-1")
    pairs = pair_return_sheets_to_borrow_sheets([b1, b2], [r1])
    assert len(pairs) == 1
    assert pairs[0][0].id == 1


def test_pair_fallback_nearest_unmatched_borrow():
    b1 = _borrow(id=1, created_at=datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc))
    b2 = _borrow(id=2, sheet_no="LY-2", created_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc))
    r1 = _ret(
        borrow_sheet_no="",
        created_at=datetime(2026, 1, 1, 18, 0, tzinfo=timezone.utc),
    )
    pairs = pair_return_sheets_to_borrow_sheets([b1, b2], [r1])
    assert pairs[0][0].id == 2


def test_outstanding_excludes_matched_borrow():
    b1 = _borrow(id=1)
    b2 = _borrow(id=2, sheet_no="LY-2", created_at=datetime(2026, 1, 2, 8, 0, tzinfo=timezone.utc))
    r1 = _ret(borrow_sheet_no="领用单#1")
    outstanding = _outstanding_ids_from_rows([b1, b2], [r1])
    assert outstanding == {2}


def test_pairing_scoped_by_mold_code():
    b_a = _borrow(id=1, mold_code="A")
    b_b = _borrow(id=2, mold_code="B", sheet_no="LY-B")
    r_a = _ret(mold_code="A", borrow_sheet_no="领用单#1")
    outstanding = _outstanding_ids_from_rows([b_a, b_b], [r_a])
    assert outstanding == {2}


def test_capacity_period_label_utc():
    from apps.haoligo.api.routes_equipment_reports import _capacity_period_label

    dt = datetime(2026, 4, 15, 10, 0, tzinfo=timezone.utc)
    assert _capacity_period_label(dt, "month") == "2026-04"
    assert _capacity_period_label(dt, "quarter") == "2026-Q2"
    assert _capacity_period_label(dt, "year") == "2026"
