"""
数据库连接和配置模块

配置 Tortoise ORM 数据库连接
使用 Tortoise ORM 官方推荐的 register_tortoise 方式自动管理连接池
"""

from tortoise import Tortoise
from tortoise.contrib.fastapi import register_tortoise
from loguru import logger

from app.config import settings


# Tortoise ORM 配置
# 注意：Tortoise ORM 使用 asyncpg 作为 PostgreSQL 驱动
# 根据官方文档：https://tortoise.github.io/
# 使用 127.0.0.1 而不是 localhost，避免 DNS 解析问题
db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST

# Tortoise ORM 配置字典
# 使用官方推荐的方式配置连接池
# 时区配置统一从 Settings 中读取，确保整个项目配置一致
TORTOISE_ORM = {
    "connections": {
        # 使用数据库连接字符串
        "default": f"postgres://{settings.DB_USER}:{settings.DB_PASSWORD}@{db_host}:{settings.DB_PORT}/{settings.DB_NAME}",
    },
    "apps": {
        "models": {
            "models": [
                "models.base",
                "models.tenant",
                "models.tenant_config",
                "models.tenant_activity_log",
                "models.user",
                "models.role",
                "models.permission",
                "models.saved_search",
                "aerich.models",
            ],
            "default_connection": "default",
        },
    },
    # 时区配置统一从 Settings 中读取（不硬编码）
    "use_tz": settings.USE_TZ,
    "timezone": settings.TIMEZONE,
}

# 全局数据库连接参数
DB_CONFIG = {
    "host": db_host,
    "port": settings.DB_PORT,
    "user": settings.DB_USER,
    "password": settings.DB_PASSWORD,
    "database": settings.DB_NAME,
    "ssl": False,  # 禁用 SSL 连接
    "command_timeout": 30,  # 命令超时（秒）
    "server_settings": {
        'application_name': 'riveredge_asyncpg'
    }
}


def register_db(app) -> None:
    """
    注册 Tortoise ORM 到 FastAPI 应用
    
    使用官方推荐的 register_tortoise 函数，自动管理连接池生命周期。
    连接池会在应用启动时自动初始化，在应用关闭时自动关闭。
    
    Args:
        app: FastAPI 应用实例
    """
    # 设置 Tortoise ORM 时区环境变量（统一格式）
    from app.config import setup_tortoise_timezone_env
    setup_tortoise_timezone_env()
    
    # 确保配置字典中的时区设置与 Settings 一致（动态更新，支持运行时配置变更）
    TORTOISE_ORM["use_tz"] = settings.USE_TZ
    TORTOISE_ORM["timezone"] = settings.TIMEZONE
    
    register_tortoise(
        app,
        config=TORTOISE_ORM,
        generate_schemas=False,  # 不自动生成模式，使用 Aerich 管理迁移
        add_exception_handlers=True,  # 添加异常处理器
    )
    logger.info(
        f"Tortoise ORM 已注册到 FastAPI 应用，连接池将自动管理 "
        f"(use_tz={settings.USE_TZ}, timezone={settings.TIMEZONE})"
    )


async def get_db_connection():
    """
    获取数据库连接

    返回一个新的 asyncpg 连接，用于直接数据库操作

    Returns:
        asyncpg.Connection: 数据库连接对象

    Raises:
        OperationalError: 当连接失败时抛出
    """
    try:
        import asyncpg
        conn = await asyncpg.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"获取数据库连接失败: {e}")
        raise OperationalError(f"数据库连接失败: {e}")


async def check_db_connection() -> bool:
    """
    检查数据库连接状态

    用于健康检查，验证数据库是否可连接

    Returns:
        bool: True 如果连接正常，False 如果连接失败
    """
    try:
        import asyncpg
        conn = await asyncpg.connect(**DB_CONFIG)
        await conn.close()
        return True
    except Exception as e:
        logger.warning(f"数据库连接检查失败: {e}")
        return False


# 注意：使用 register_tortoise 后，连接池会自动管理，不需要手动检查或重新初始化
# Tortoise ORM 会自动处理连接池的生命周期，包括：
# - 应用启动时自动初始化连接池
# - 应用关闭时自动关闭连接池
# - 连接池中的连接会自动恢复和重用


# 注意：使用 register_tortoise 后，不需要手动重试机制
# Tortoise ORM 的连接池会自动处理连接恢复和错误重试
