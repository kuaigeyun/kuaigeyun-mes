"""guest 演示组织管理员域名单元测试。"""

from infra.domain.tenant.guest_tenant_admin import (
    GUEST_TENANT_ADMIN_DOMAINS,
    guest_may_be_tenant_admin,
)


def test_guest_may_be_tenant_admin_for_demo_domains():
    for domain in GUEST_TENANT_ADMIN_DOMAINS:
        assert guest_may_be_tenant_admin(tenant_domain=domain) is True
        assert guest_may_be_tenant_admin(tenant_domain=f"  {domain.upper()}  ") is True


def test_guest_may_not_be_tenant_admin_for_other_domains():
    assert guest_may_be_tenant_admin(tenant_domain="other-org") is False
    assert guest_may_be_tenant_admin(tenant_domain=None) is False
    assert guest_may_be_tenant_admin(tenant_domain="") is False
