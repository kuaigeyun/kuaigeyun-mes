"""First pass yield service tests."""

from apps.kuaizhizao.services.first_pass_yield_service import compute_first_pass_yield_rate


def test_compute_first_pass_yield_rate_basic():
    assert compute_first_pass_yield_rate(95, 100) == 95.0
    assert compute_first_pass_yield_rate(0, 0) == 0.0
    assert compute_first_pass_yield_rate(1, 3) == 33.33


def test_first_pass_yield_not_above_qualification_when_rework_improves():
    # 首次报工 80/100，返工后总体 98/100 — 直通率应低于合格率
    first_pass = compute_first_pass_yield_rate(80, 100)
    overall = compute_first_pass_yield_rate(98, 100)
    assert first_pass < overall
