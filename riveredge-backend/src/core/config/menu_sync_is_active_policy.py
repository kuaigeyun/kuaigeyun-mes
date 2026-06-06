"""菜单同步时是否覆盖已有 ``is_active`` 的集中策略（供 MenuService 调用）。"""

from __future__ import annotations

from typing import Optional


def resolve_sync_is_active_for_existing_row(
    is_active: bool,
    preserve_existing_is_active: bool,
) -> Optional[bool]:
    """
    对已存在菜单行，决定是否写入 ``is_active``。

    - ``preserve_existing_is_active=True``：不覆盖（返回 ``None``，调用方跳过赋值）。
    - ``False``：采用本次同步传入的 ``is_active``。
    """
    if preserve_existing_is_active:
        return None
    return is_active


__all__ = ["resolve_sync_is_active_for_existing_row"]
