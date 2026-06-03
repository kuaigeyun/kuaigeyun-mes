"""好力 GO — 业务消息提醒 dispatch 上下文（开单用户指定接收人）。"""

from __future__ import annotations

from typing import Any, Dict, List


def _normalize_user_ids(raw: Any) -> List[int]:
    if raw is None:
        return []
    if isinstance(raw, (int, str)):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    out: List[int] = []
    seen: set[int] = set()
    for item in raw:
        try:
            uid = int(item)
        except (TypeError, ValueError):
            continue
        if uid < 1 or uid in seen:
            continue
        seen.add(uid)
        out.append(uid)
    return out


def with_form_notify_user_ids(ctx: Dict[str, Any], user_ids: Any) -> Dict[str, Any]:
    """将单据上的通知接收人写入 dispatch context（供 user_specified 范围解析）。"""
    ids = _normalize_user_ids(user_ids)
    if ids:
        ctx = dict(ctx)
        ctx["form_notify_user_ids"] = ids
        ctx["report_notify_user_ids"] = ids
    return ctx
