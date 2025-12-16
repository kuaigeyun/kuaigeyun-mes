"""
Redis 缓存工具模块

提供 Redis 缓存操作的封装
"""

from typing import Optional

from loguru import logger
from redis.asyncio import Redis
from redis.asyncio.connection import ConnectionPool

from infra.config.infra_config import infra_settings as settings


class Cache:
    """
    Redis 缓存工具类

    提供 Redis 缓存的常用操作方法
    """

    _redis: Optional[Redis] = None
    _pool: Optional[ConnectionPool] = None

    @classmethod
    async def connect(cls) -> None:
        """
        连接 Redis

        在应用启动时调用，建立 Redis 连接
        """
        try:
            # 使用 redis 库的异步接口（兼容 Python 3.12）
            cls._pool = ConnectionPool.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            cls._redis = Redis(connection_pool=cls._pool)

            # 测试连接
            await cls._redis.ping()

            logger.info(f"Redis 连接成功: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        except Exception as e:
            logger.error(f"Redis 连接失败: {e}")
            raise

    @classmethod
    async def disconnect(cls) -> None:
        """
        断开 Redis 连接

        在应用关闭时调用，关闭 Redis 连接
        """
        if cls._redis:
            await cls._redis.aclose()
        if cls._pool:
            await cls._pool.aclose()
        logger.info("Redis 连接已关闭")

    @classmethod
    async def get(cls, key: str) -> Optional[str]:
        """
        获取缓存值

        Args:
            key: 缓存键

        Returns:
            Optional[str]: 缓存值，如果不存在返回 None
        """
        if not cls._redis:
            raise RuntimeError("Redis 未连接，请先调用 connect()")

        return await cls._redis.get(key)

    @classmethod
    async def set(
        cls,
        key: str,
        value: str,
        expire: Optional[int] = None,
    ) -> bool:
        """
        设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
            expire: 过期时间（秒），None 表示不过期

        Returns:
            bool: 是否设置成功
        """
        if not cls._redis:
            raise RuntimeError("Redis 未连接，请先调用 connect()")

        return await cls._redis.set(key, value, ex=expire)

    @classmethod
    async def delete(cls, key: str) -> int:
        """
        删除缓存

        Args:
            key: 缓存键

        Returns:
            int: 删除的键数量
        """
        if not cls._redis:
            raise RuntimeError("Redis 未连接，请先调用 connect()")

        return await cls._redis.delete(key)

    @classmethod
    async def exists(cls, key: str) -> bool:
        """
        检查缓存是否存在

        Args:
            key: 缓存键

        Returns:
            bool: 是否存在
        """
        if not cls._redis:
            raise RuntimeError("Redis 未连接，请先调用 connect()")

        return await cls._redis.exists(key) > 0

    @classmethod
    async def expire(cls, key: str, seconds: int) -> bool:
        """
        设置缓存过期时间

        Args:
            key: 缓存键
            seconds: 过期时间（秒）

        Returns:
            bool: 是否设置成功
        """
        if not cls._redis:
            raise RuntimeError("Redis 未连接，请先调用 connect()")

        return await cls._redis.expire(key, seconds)


async def check_redis_connection() -> bool:
    """
    检查 Redis 连接状态

    用于健康检查，验证 Redis 是否可连接

    Returns:
        bool: True 如果连接正常，False 如果连接失败
    """
    try:
        # 如果已有连接实例，使用 ping 检查
        if cache._redis:
            await cache._redis.ping()
            return True

        # 如果没有连接实例，创建临时连接检查
        temp_redis = Redis.from_url(settings.REDIS_URL)
        await temp_redis.ping()
        await temp_redis.aclose()
        return True
    except Exception as e:
        logger.warning(f"Redis 连接检查失败: {e}")
        return False


# 创建全局缓存实例
cache = Cache()
