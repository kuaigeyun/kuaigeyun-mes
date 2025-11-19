"""
数据库连接和配置模块

配置 Tortoise ORM 数据库连接
"""

import asyncio
from typing import Callable, Any

from tortoise import Tortoise
from tortoise.contrib.fastapi import register_tortoise
from tortoise.exceptions import OperationalError
from asyncpg.exceptions import ConnectionDoesNotExistError
from loguru import logger

from app.config import settings


# Tortoise ORM 配置
# 注意：Tortoise ORM 使用 asyncpg 作为 PostgreSQL 驱动
# 根据官方文档：https://tortoise.github.io/
# 使用 127.0.0.1 而不是 localhost，避免 DNS 解析问题
db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST

# 使用 credentials 字典配置（更稳定，支持更多参数）
# 由于 Windows 环境下 asyncpg + uvicorn 的兼容性问题
# 我们暂时禁用 Tortoise ORM 的自动连接管理
# 改为在需要时直接使用 asyncpg 创建连接

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
                "models.user",
                "models.role",
                "models.permission",
                "aerich.models",
            ],
            "default_connection": "default",
        },
    },
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


async def init_db() -> None:
    """
    初始化数据库连接

    初始化 Tortoise ORM 和数据库连接
    """
    try:
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        logger.info("Tortoise ORM 初始化成功")

        # 生成数据库模式（如果不存在）
        await Tortoise.generate_schemas()
        logger.info("数据库模式生成完成")

    except Exception as e:
        logger.warning(f"Tortoise ORM 初始化失败，跳过数据库连接: {e}")
        # 不抛出异常，让应用继续启动（用于开发环境）


async def close_db() -> None:
    """
    关闭数据库连接

    关闭 Tortoise ORM 连接
    """
    try:
        await Tortoise.close_connections()
        logger.info("Tortoise ORM 连接已关闭")
    except Exception as e:
        logger.warning(f"关闭 Tortoise ORM 连接时出错: {e}")


def register_db(app) -> None:
    """
    注册数据库组件到 FastAPI 应用

    由于 Windows 兼容性问题，暂时跳过 Tortoise ORM 注册
    数据库连接将在需要时直接使用 asyncpg 创建

    Args:
        app: FastAPI 应用实例
    """
    logger.info("跳过 Tortoise ORM 注册，使用直接 asyncpg 连接")


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


async def ensure_db_connection() -> None:
    """
    确保数据库连接可用
    
    检查数据库连接池是否已初始化。如果连接池未初始化，则尝试初始化。
    注意：不执行查询验证，因为连接池会自动处理连接恢复。
    
    Raises:
        OperationalError: 当无法初始化数据库连接时抛出
    """
    try:
        # 尝试获取连接，如果连接池未初始化会抛出异常
        Tortoise.get_connection("default")
        # 不执行查询验证，让连接池自动处理连接恢复
        # 如果连接池中的连接已关闭，asyncpg 会自动创建新连接
    except (ConnectionDoesNotExistError, OperationalError, AttributeError) as e:
        logger.warning(f"数据库连接池未初始化，尝试初始化: {e}")
        try:
            # 尝试初始化连接池（register_tortoise 应该已经初始化了，但可能在某些情况下失败）
            await Tortoise.init(config=TORTOISE_ORM)
            logger.info("数据库连接池初始化成功")
        except Exception as init_error:
            logger.error(f"数据库连接池初始化失败: {init_error}")
            raise OperationalError("无法初始化数据库连接池") from init_error
    except Exception as e:
        # 其他异常，可能是连接池已初始化但连接暂时不可用
        # 这种情况不需要重新初始化，连接池会自动恢复
        logger.debug(f"数据库连接检查: {e}")
        pass  # 不抛出异常，让连接池自动处理


async def db_operation_with_retry(
    operation: Callable,
    max_retries: int = 5,  # 增加重试次数
    retry_delay: float = 0.5,  # 增加重试延迟，给连接池更多恢复时间
    *args,
    **kwargs
) -> Any:
    """
    带重试机制的数据库操作
    
    执行数据库操作，如果遇到连接错误则自动重试。
    
    Args:
        operation: 要执行的数据库操作函数（必须是异步函数）
        max_retries: 最大重试次数（默认 3 次）
        retry_delay: 重试延迟（秒，默认 0.1 秒）
        *args: 传递给操作函数的位置参数
        **kwargs: 传递给操作函数的关键字参数
        
    Returns:
        Any: 操作函数的返回值
        
    Raises:
        Exception: 当所有重试都失败时抛出最后一个异常
    """
    last_exception = None
    
    for attempt in range(max_retries):
        try:
            # 在每次重试前等待（第一次不等待）
            if attempt > 0:
                await asyncio.sleep(retry_delay * attempt)  # 递增延迟
                # 在重试前确保连接池已初始化（不执行查询，让连接池自动恢复）
                try:
                    await ensure_db_connection()
                except Exception as conn_error:
                    logger.debug(f"重试前连接池检查失败，继续重试: {conn_error}")
            
            # 执行操作（连接池会自动处理连接恢复）
            return await operation(*args, **kwargs)
            
        except (ConnectionDoesNotExistError, OperationalError) as e:
            last_exception = e
            if attempt < max_retries - 1:
                logger.warning(
                    f"数据库操作失败（尝试 {attempt + 1}/{max_retries}），"
                    f"将在 {retry_delay * (attempt + 1):.2f} 秒后重试: {e}"
                )
                # 在重试前尝试确保连接池已初始化
                try:
                    await ensure_db_connection()
                except Exception as reconnect_error:
                    logger.debug(f"重试前连接池初始化失败，继续重试: {reconnect_error}")
            else:
                logger.error(f"数据库操作失败，已重试 {max_retries} 次: {e}")
        except Exception:
            # 非连接错误，直接抛出
            raise
    
    # 所有重试都失败，抛出最后一个异常
    if last_exception:
        raise last_exception
    raise RuntimeError("数据库操作失败，未知错误")
