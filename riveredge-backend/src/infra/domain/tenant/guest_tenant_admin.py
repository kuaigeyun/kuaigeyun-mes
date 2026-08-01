"""体验账号 guest 在指定演示组织内保留组织管理员身份。"""

from typing import FrozenSet

# 与 core_tenants.domain 对齐；部署侧通过迁移按组织名回填 is_tenant_admin。
GUEST_TENANT_ADMIN_DOMAINS: FrozenSet[str] = frozenset(
    {
        "default",  # 无锡快格信息技术有限公司
        "kgsoft",  # 无锡快格软件有限公司
        "kgsoft-cali",  # Kgsoft California Branch
    }
)


def guest_may_be_tenant_admin(*, tenant_domain: str | None) -> bool:
    return (tenant_domain or "").strip().lower() in GUEST_TENANT_ADMIN_DOMAINS
