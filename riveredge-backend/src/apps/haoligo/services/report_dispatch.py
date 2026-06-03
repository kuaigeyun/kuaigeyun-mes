"""好力 GO — 上报类单据是否触发消息提醒（与 report_notify_user_ids 是否为空解耦）。"""

from __future__ import annotations

from typing import List


def should_send_report_notification(
    *,
    report_enabled: bool,
    old_report_enabled: bool,
    report_fields_touched: bool,
    old_notify_user_ids: List[int],
    new_notify_user_ids: List[int],
    on_create: bool = False,
    content_fields_touched: bool = False,
    already_sent: bool = False,
) -> bool:
    """report_enabled 为真且发生首次开启、上报字段变更或（未发过时的）内容保存时派发。"""
    if not report_enabled:
        return False
    if on_create:
        return True
    if not old_report_enabled and report_enabled:
        return True
    if report_fields_touched and set(old_notify_user_ids) != set(new_notify_user_ids):
        return True
    if report_fields_touched and not already_sent:
        return True
    if content_fields_touched and report_enabled and not already_sent:
        return True
    return False
