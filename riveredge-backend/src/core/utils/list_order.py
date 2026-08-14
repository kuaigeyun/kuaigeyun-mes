"""
列表默认排序契约（PC / API 缺省时唯一真源）

缺省（未传 order_by / sort）时：按创建时间倒序，新建在上；同秒用 id 倒序稳定。
禁止用 updated_at 冒充「新建在上」。
"""

from __future__ import annotations

DEFAULT_LIST_ORDER_BY = "-created_at"
DEFAULT_LIST_ORDER_BY_WITH_ID = ("-created_at", "-id")


def resolve_default_list_order_by(
    order_by: str | None = None,
    *,
    with_id_tiebreaker: bool = False,
) -> str | tuple[str, ...]:
    """
    空 / 空白 order_by → 创建时间倒序。
    with_id_tiebreaker=True 时返回 ("-created_at", "-id")，供 QuerySet.order_by(*clause)。
    """
    raw = (order_by or "").strip()
    if not raw:
        if with_id_tiebreaker:
            return DEFAULT_LIST_ORDER_BY_WITH_ID
        return DEFAULT_LIST_ORDER_BY
    if with_id_tiebreaker:
        # 调用方已给字段时仍附 id，避免同值抖动（方向与主字段一致）
        desc = raw.startswith("-")
        field = raw.lstrip("-")
        if field == "id":
            return (raw,)
        return (raw, "-id" if desc else "id")
    return raw
