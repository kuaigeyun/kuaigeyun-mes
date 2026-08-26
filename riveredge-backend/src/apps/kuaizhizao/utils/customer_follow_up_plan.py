"""客户跟进计划状态判定（销售中心 KPI 与列表逾期徽章共用）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple

from core.utils.timezone_utils import to_site_date


def follow_up_plan_flags(
    next_at: Optional[datetime],
    *,
    now: datetime,
    now_date,
) -> Tuple[bool, bool]:
    """
    返回 (待跟进, 已逾期)。

    - 待跟进：计划跟进站点日历日 <= 今日
    - 已逾期：计划跟进时刻 <= 当前业务时刻
    """
    if next_at is None:
        return False, False
    pending = to_site_date(next_at) <= now_date
    overdue = next_at <= now
    return pending, overdue
