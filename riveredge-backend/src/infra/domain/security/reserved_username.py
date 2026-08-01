"""
注册/租户用户名保留字校验（禁止常见管理员/系统类用户名）
"""

from __future__ import annotations

# 精确匹配（比较时已规范化：小写、去 _ -）
RESERVED_USERNAME_EXACT: frozenset[str] = frozenset(
    {
        "admin",
        "administrator",
        "adm",
        "root",
        "superadmin",
        "super",
        "sysadmin",
        "system",
        "sys",
        "manager",
        "operator",
        "webmaster",
        "master",
        "support",
        "service",
        "test",
        "demo",
        "guest",
        "infraadmin",
        "superuser",
        "moderator",
        "owner",
        "boss",
        "sa",
        "dba",
        "devops",
        "postmaster",
        "nginx",
        "apache",
        "tomcat",
        "mysql",
        "postgres",
        "oracle",
        "redis",
        "nacos",
        "console",
        "dashboard",
        "api",
        "www",
        "mail",
        "ftp",
        "null",
        "undefined",
        "anonymous",
        "nobody",
    }
)

# 租户 User 表由系统独占、管理员不可自建/改名的账户
SYSTEM_MANAGED_TENANT_USERNAMES_RAW: frozenset[str] = frozenset({"guest"})

# 禁止「前缀 + 可选数字」形式，如 admin、admin1、root2024
RESERVED_USERNAME_PREFIXES: tuple[str, ...] = (
    "admin",
    "administrator",
    "root",
    "superadmin",
    "sysadmin",
    "system",
    "infraadmin",
)


def normalize_username_key(username: str) -> str:
    return username.strip().lower().replace("_", "").replace("-", "")


def is_platform_superadmin_username(username: str) -> bool:
    raw = (username or "").strip().lower()
    if raw == "infra_admin":
        return True
    return normalize_username_key(username) == "infraadmin"


def is_system_managed_tenant_username(username: str) -> bool:
    return (username or "").strip().lower() in SYSTEM_MANAGED_TENANT_USERNAMES_RAW


def is_reserved_username(username: str) -> bool:
    if not username or not username.strip():
        return False
    key = normalize_username_key(username)
    if not key:
        return False
    if key in RESERVED_USERNAME_EXACT:
        return True
    for prefix in RESERVED_USERNAME_PREFIXES:
        if key == prefix:
            return True
        if key.startswith(prefix):
            suffix = key[len(prefix) :]
            if suffix.isdigit():
                return True
    return False


def reserved_username_message() -> str:
    return "该用户名不可用，请更换其他用户名"


def platform_superadmin_username_message() -> str:
    return "该用户名为平台系统保留，租户账户不可使用"


def system_managed_username_message() -> str:
    return "该用户名为系统保留，不可占用或修改"


def assert_username_not_reserved(username: str) -> str:
    if is_reserved_username(username):
        raise ValueError(reserved_username_message())
    return username.strip()


def assert_tenant_user_username_allowed(username: str, *, system_bootstrap: bool = False) -> str:
    """租户 User 创建/改名校验。"""
    cleaned = (username or "").strip()
    if not cleaned:
        raise ValueError("用户名不能为空")
    if is_platform_superadmin_username(cleaned):
        raise ValueError(platform_superadmin_username_message())
    if system_bootstrap:
        if cleaned.lower() != "guest":
            assert_username_not_reserved(cleaned)
        return cleaned
    if is_system_managed_tenant_username(cleaned):
        raise ValueError(system_managed_username_message())
    assert_username_not_reserved(cleaned)
    return cleaned


def assert_tenant_user_username_mutation_allowed(*, current_username: str, new_username: str) -> str:
    """租户 User 改名校验：禁止改成系统保留名，且系统账户 guest 不可改名。"""
    current = (current_username or "").strip()
    new = assert_tenant_user_username_allowed(new_username)
    if is_system_managed_tenant_username(current) and new.lower() != current.lower():
        raise ValueError(system_managed_username_message())
    return new
