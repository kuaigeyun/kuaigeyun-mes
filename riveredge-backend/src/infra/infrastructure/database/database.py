"""
数据库连接和配置模块

配置 Tortoise ORM 数据库连接
使用 Tortoise ORM 官方推荐的 register_tortoise 方式自动管理连接池
"""

from tortoise.contrib.fastapi import register_tortoise
from tortoise.exceptions import OperationalError
from loguru import logger

from infra.config.platform_config import platform_settings as settings


# Tortoise ORM 配置
# 注意：Tortoise ORM 使用 asyncpg 作为 PostgreSQL 驱动
# 根据官方文档：https://tortoise.github.io/
# 使用 127.0.0.1 而不是 localhost，避免 DNS 解析问题
db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST

# Tortoise ORM 配置字典
# 使用官方推荐的方式配置连接池
# 时区配置统一从 Settings 中读取，确保整个项目配置一致
# 连接池配置参数（解决 "connection was closed in the middle of operation" 错误）：
# 使用字典配置方式，显式指定连接参数和连接池配置
# 注意：Tortoise ORM 0.20.1 支持在 credentials 中传递连接池参数
TORTOISE_ORM = {
    "connections": {
        "default": {
            "engine": "tortoise.backends.asyncpg",
            "credentials": {
                "host": db_host,
                "port": settings.DB_PORT,
                "user": settings.DB_USER,
                "password": settings.DB_PASSWORD,
                "database": settings.DB_NAME,
                # 连接池配置（解决连接中断问题）
                # 这些参数会传递给 asyncpg.create_pool()
                "min_size": 5,  # 最小连接池大小
                "max_size": 20,  # 最大连接池大小（增加以支持并发请求）
                "max_queries": 50000,  # 每个连接最大查询次数
                "max_inactive_connection_lifetime": 300.0,  # 非活跃连接最大生存时间（秒，必须是浮点数）
                "command_timeout": 60,  # 命令超时（秒）
                "server_settings": {
                    "application_name": "riveredge_asyncpg",
                    "timezone": settings.TIMEZONE  # 使用与Tortoise ORM相同的时区
                }
            }
        },
    },
    "apps": {
        "models": {
            "models": [
                # 平台级模型（infra）
                "infra.models.base",
                "infra.models.tenant",
                "infra.models.tenant_config",
                "infra.models.tenant_activity_log",
                "infra.models.user",
                "infra.models.platform_superadmin",  # 平台超级管理员模型
                "infra.models.package",
                "infra.models.saved_search",  # 保存搜索条件模型
                # 系统级模型（core）
                "core.models.role",
                "core.models.permission",
                "core.models.role_permission",
                "core.models.user_role",
                "core.models.department",
                "core.models.position",
                "core.models.data_dictionary",
                "core.models.dictionary_item",
                "core.models.system_parameter",
                "core.models.code_rule",
                "core.models.code_sequence",
                "core.models.custom_field",
                "core.models.custom_field_value",
                "core.models.site_setting",
                "core.models.invitation_code",
                "core.models.language",
                "core.models.application",
                "core.models.menu",
                "core.models.integration_config",
                "core.models.file",
                "core.models.api",
                "core.models.data_source",
                "core.models.dataset",
                "core.models.message_config",
                "core.models.message_template",
                "core.models.message_log",
                "core.models.scheduled_task",
                "core.models.approval_process",
                "core.models.approval_instance",
                "core.models.script",
                "core.models.print_template",
                "core.models.print_device",
                "core.models.user_preference",
                "core.models.operation_log",
                "core.models.login_log",
                "core.models.data_backup",
                # Aerich 模型
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
        'application_name': 'riveredge_asyncpg',
        'timezone': settings.TIMEZONE  # 使用与Tortoise ORM相同的时区
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
    from infra.config.platform_config import setup_tortoise_timezone_env
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
