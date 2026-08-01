"""系统/租户保留用户名校验。"""

import unittest

from infra.domain.security.reserved_username import (
    assert_tenant_user_username_allowed,
    assert_tenant_user_username_mutation_allowed,
    is_platform_superadmin_username,
    is_reserved_username,
)


class ReservedUsernameTests(unittest.TestCase):
    def test_infra_admin_is_platform_reserved(self):
        self.assertTrue(is_platform_superadmin_username("infra_admin"))
        self.assertTrue(is_platform_superadmin_username("INFRA-ADMIN"))
        self.assertTrue(is_reserved_username("infra_admin"))

    def test_tenant_user_cannot_take_infra_admin(self):
        with self.assertRaises(ValueError):
            assert_tenant_user_username_allowed("infra_admin")

    def test_system_bootstrap_allows_guest_only(self):
        self.assertEqual(assert_tenant_user_username_allowed("guest", system_bootstrap=True), "guest")
        with self.assertRaises(ValueError):
            assert_tenant_user_username_allowed("infra_admin", system_bootstrap=True)

    def test_guest_username_immutable_for_tenant_users(self):
        with self.assertRaises(ValueError):
            assert_tenant_user_username_mutation_allowed(current_username="guest", new_username="hacker")

    def test_regular_user_cannot_rename_to_guest(self):
        with self.assertRaises(ValueError):
            assert_tenant_user_username_mutation_allowed(current_username="sales01", new_username="guest")


if __name__ == "__main__":
    unittest.main()
