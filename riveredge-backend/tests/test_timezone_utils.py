"""timezone_utils 单元测试。"""

from datetime import timedelta

from core.timezone_utils import is_future_datetime, now_utc


def test_is_future_datetime_aware_utc_not_future():
    past = now_utc() - timedelta(minutes=5)
    assert is_future_datetime(past) is False


def test_is_future_datetime_aware_utc_is_future():
    future = now_utc() + timedelta(hours=2)
    assert is_future_datetime(future) is True


def test_is_future_datetime_naive_wall_clock():
    """naive 墙钟按 naive_tz 解释后不应误判为未来。"""
    past = (now_utc() - timedelta(minutes=5)).replace(tzinfo=None)
    assert is_future_datetime(past, naive_tz="UTC") is False


def test_is_future_datetime_respects_slack():
    slightly_ahead = now_utc() + timedelta(seconds=30)
    assert is_future_datetime(slightly_ahead, slack_seconds=60) is False
    assert is_future_datetime(slightly_ahead, slack_seconds=0) is True
