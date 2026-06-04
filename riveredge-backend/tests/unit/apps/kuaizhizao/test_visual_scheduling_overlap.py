"""visual_scheduling_service 区间重叠等纯逻辑测试。"""



from datetime import datetime



from apps.kuaizhizao.services.visual_scheduling_service import (

    _intervals_overlap,

    _operation_start_before_prev_start,

)





def test_intervals_overlap_touching_end_not_overlap():

    s1 = datetime(2026, 6, 1, 8, 0)

    e1 = datetime(2026, 6, 1, 12, 0)

    s2 = datetime(2026, 6, 1, 12, 0)

    e2 = datetime(2026, 6, 1, 16, 0)

    assert not _intervals_overlap(s1, e1, s2, e2)





def test_intervals_overlap_partial():

    s1 = datetime(2026, 6, 1, 8, 0)

    e1 = datetime(2026, 6, 1, 14, 0)

    s2 = datetime(2026, 6, 1, 12, 0)

    e2 = datetime(2026, 6, 1, 18, 0)

    assert _intervals_overlap(s1, e1, s2, e2)





def test_sequence_same_start_not_conflict():

    prev_start = datetime(2026, 6, 10, 8, 0)

    next_start = datetime(2026, 6, 10, 8, 0)

    assert not _operation_start_before_prev_start(next_start, prev_start)





def test_sequence_next_starts_before_prev_end_but_after_prev_start_not_conflict():

    prev_start = datetime(2026, 6, 10, 8, 0)

    next_start = datetime(2026, 6, 10, 10, 0)

    assert not _operation_start_before_prev_start(next_start, prev_start)





def test_sequence_next_starts_before_prev_start_is_conflict():

    prev_start = datetime(2026, 6, 10, 10, 0)

    next_start = datetime(2026, 6, 10, 9, 0)

    assert _operation_start_before_prev_start(next_start, prev_start)


