"""
应用 manifest 同步到 core_menus 时，对「已存在菜单行」的 is_active 写入策略。

放在 core 根下，避免 import core.services 时触发 services/__init__ 侧效应。
单一事实来源；行为变更时必须同步更新 tests/test_menu_sync_is_active_policy.py。
"""
from __future__ import annotations

from typing import Optional


def resolve_sync_is_active_for_existing_row(
    application_level_is_active: bool,
    preserve_existing_is_active: bool,
) -> Optional[bool]:
    """
    返回应对已存在菜单行设置的 is_active；若返回 None 则表示不修改数据库中的 is_active。

    规则（与产品一致）：
    - 应用级停用 (application_level_is_active=False)：必须将菜单行设为 False，避免出现「应用已停、菜单仍启用」。
    - 应用级启用且 preserve=True：不覆盖租户在菜单管理中对各行的开关。
    - 应用级启用且 preserve=False：整批与传入值对齐（如应用中心「启用应用」）。
    """
    if not application_level_is_active:
        return False
    if not preserve_existing_is_active:
        return application_level_is_active
    return None
