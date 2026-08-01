"""用户姓名碰撞检测与展示标签。"""

from __future__ import annotations

import unittest

from core.services.user.user_display_service import UserDisplayService


class UserDisplayServiceTests(unittest.TestCase):
    def test_format_label_includes_username_when_both_present(self):
        label = UserDisplayService.format_label(
            full_name="体验用户",
            username="guest",
            user_id=341,
        )
        self.assertEqual(label, "体验用户 (guest)")

    def test_format_label_username_only(self):
        label = UserDisplayService.format_label(
            full_name="",
            username="guest",
            user_id=341,
        )
        self.assertEqual(label, "guest")


if __name__ == "__main__":
    unittest.main()
