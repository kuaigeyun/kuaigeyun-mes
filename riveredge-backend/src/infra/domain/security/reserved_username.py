"""
注册用户名保留字校验（禁止常见管理员/系统类用户名）
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

# 禁止「前缀 + 可选数字」形式，如 admin、admin1、root2024
RESERVED_USERNAME_PREFIXES: tuple[str, ...] = (
    "admin",
    "administrator",
    "root",
    "superadmin",
    "sysadmin",
    "system",
)


def normalize_username_key(username: str) -> str:
    return username.strip().lower().replace("_", "").replace("-", "")


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


def assert_username_not_reserved(username: str) -> str:
    if is_reserved_username(username):
        raise ValueError(reserved_username_message())
    return username.strip()
