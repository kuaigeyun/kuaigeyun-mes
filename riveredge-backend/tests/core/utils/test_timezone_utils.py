"""resolve_business_datetime 单元测试。"""

from datetime import datetime, timezone

from core.utils.timezone_utils import resolve_business_datetime, to_site_date


def test_resolve_business_datetime_from_utc_aware():
    src = datetime(2026, 6, 21, 8, 51, 54, tzinfo=timezone.utc)
    out = resolve_business_datetime(src)
    assert out.tzinfo == timezone.utc
    assert out.hour == 8
    assert to_site_date(out).isoformat() == "2026-06-21"


def test_resolve_business_datetime_from_naive_site_wall_clock():
    # 模拟 datetime.now() 在 Asia/Shanghai 服务器上的 naive 墙钟
    naive = datetime(2026, 6, 21, 16, 51, 54)
    out = resolve_business_datetime(naive)
    assert out.tzinfo == timezone.utc
    assert out.hour == 8
    assert to_site_date(out).isoformat() == "2026-06-21"
