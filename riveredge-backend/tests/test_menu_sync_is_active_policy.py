"""菜单 manifest 同步时 is_active 策略（无 DB，防回归）。"""

from core.menu_sync_is_active_policy import resolve_sync_is_active_for_existing_row


def test_app_disabled_always_forces_menu_row_false():
    """应用停用时必须关菜单行，不受 preserve 保护。"""
    assert resolve_sync_is_active_for_existing_row(False, True) is False
    assert resolve_sync_is_active_for_existing_row(False, False) is False


def test_app_enabled_preserve_true_does_not_touch_row():
    """应用仍启用且仅同步结构时，不覆盖租户对单行的开关。"""
    assert resolve_sync_is_active_for_existing_row(True, True) is None


def test_app_enabled_preserve_false_aligns_row():
    """整应用重新启用等场景，与传入的应用级启用状态对齐。"""
    assert resolve_sync_is_active_for_existing_row(True, False) is True


if __name__ == "__main__":
    test_app_disabled_always_forces_menu_row_false()
    test_app_enabled_preserve_true_does_not_touch_row()
    test_app_enabled_preserve_false_aligns_row()
    print("test_menu_sync_is_active_policy: ok")
