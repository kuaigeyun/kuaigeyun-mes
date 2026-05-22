"""
数据库配置模块

提供数据库连接配置

⚠️ 当前仓库无导入方引用本模块（保留以兼容第三方脚本），
连接池大小与 infra/infrastructure/database/database.py 的运行态配置保持一致，
均通过 RIVEREDGE_DB_POOL_MIN / RIVEREDGE_DB_POOL_MAX 环境变量可覆盖。
"""

import os

from infra.config.infra_config import infra_settings


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


_POOL_MIN = _int_env("RIVEREDGE_DB_POOL_MIN", 2)
_POOL_MAX = _int_env("RIVEREDGE_DB_POOL_MAX", 10)

# 数据库配置（从平台级配置读取）
DB_HOST = infra_settings.DB_HOST
DB_PORT = infra_settings.DB_PORT
DB_USER = infra_settings.DB_USER
DB_PASSWORD = infra_settings.DB_PASSWORD
DB_NAME = infra_settings.DB_NAME
DB_URL = infra_settings.DB_URL

# Tortoise ORM 配置
# 注意：使用 127.0.0.1 而不是 localhost，避免 DNS 解析问题
db_host = "127.0.0.1" if DB_HOST == "localhost" else DB_HOST

TORTOISE_ORM = {
    "connections": {
        "default": {
            "engine": "tortoise.backends.asyncpg",
            "credentials": {
                "host": db_host,
                "port": DB_PORT,
                "user": DB_USER,
                "password": DB_PASSWORD,
                "database": DB_NAME,
                # 连接池配置（与 infra/infrastructure/database/database.py 一致，走 ENV）
                "min_size": _POOL_MIN,
                "max_size": _POOL_MAX,
                "max_queries": 50000,
                "max_inactive_connection_lifetime": 300.0,
                "command_timeout": 60,
                "server_settings": {
                    "application_name": "riveredge_asyncpg"
                }
            }
        },
    },
    "apps": {
        "models": {
            "models": ["infra.models", "core.models", "aerich.models"],
            "default_connection": "default",
        },
    },
    "use_tz": infra_settings.USE_TZ,
    "timezone": infra_settings.TIMEZONE,
}

