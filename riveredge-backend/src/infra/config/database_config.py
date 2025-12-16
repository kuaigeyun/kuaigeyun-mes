"""
数据库配置模块

提供数据库连接配置
"""

from infra.config.infra_config import infra_settings

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
                # 连接池配置
                "min_size": 5,
                "max_size": 20,
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
            "models": ["infra.models", "aerich.models"],
            "default_connection": "default",
        },
    },
    "use_tz": infra_settings.USE_TZ,
    "timezone": infra_settings.TIMEZONE,
}

