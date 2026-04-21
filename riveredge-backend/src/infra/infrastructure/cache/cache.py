"""
PostgreSQL 缓存工具模块
"""

from datetime import datetime, timedelta
from typing import Optional

from loguru import logger

from core.models.cache_entry import CacheEntry


class Cache:
    """
    PostgreSQL 缓存工具类
    """
    _connected: bool = False

    @classmethod
    async def connect(cls) -> None:
        """
        连接缓存（PG 无需单独连接池）
        """
        cls._connected = True
        logger.info("PostgreSQL cache connected")

    @classmethod
    async def disconnect(cls) -> None:
        """
        断开缓存连接
        """
        cls._connected = False
        logger.info("PostgreSQL cache disconnected")

    @classmethod
    async def get(cls, key: str) -> Optional[str]:
        """
        获取缓存值

        Args:
            key: 缓存键

        Returns:
            Optional[str]: 缓存值，如果不存在返回 None
        """
        if not cls._connected:
            raise RuntimeError("Cache 未连接，请先调用 connect()")
        namespace, real_key = cls._split_key(key)
        entry = await CacheEntry.filter(namespace=namespace, key=real_key).first()
        if not entry:
            return None
        if entry.expires_at and entry.expires_at <= datetime.now():
            await entry.delete()
            return None
        return entry.value

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
        if not cls._connected:
            raise RuntimeError("Cache 未连接，请先调用 connect()")
        namespace, real_key = cls._split_key(key)
        expires_at = datetime.now() + timedelta(seconds=expire) if expire else None
        await CacheEntry.update_or_create(
            defaults={"value": value, "expires_at": expires_at},
            namespace=namespace,
            key=real_key,
        )
        return True

    @classmethod
    async def delete(cls, key: str) -> int:
        """
        删除缓存

        Args:
            key: 缓存键

        Returns:
            int: 删除的键数量
        """
        if not cls._connected:
            raise RuntimeError("Cache 未连接，请先调用 connect()")
        namespace, real_key = cls._split_key(key)
        return await CacheEntry.filter(namespace=namespace, key=real_key).delete()

    @classmethod
    async def delete_by_pattern(cls, pattern: str) -> int:
        """
        按照模式删除缓存

        Args:
            pattern: 匹配模式，如 "riveredge:menu:*"

        Returns:
            int: 删除的键数量
        """
        if not cls._connected:
            raise RuntimeError("Cache 未连接，请先调用 connect()")
        namespace, like_pattern = cls._pattern_to_like(pattern)
        return await CacheEntry.filter(namespace=namespace, key__icontains=like_pattern).delete()

    @classmethod
    async def exists(cls, key: str) -> bool:
        """
        检查缓存是否存在

        Args:
            key: 缓存键

        Returns:
            bool: 是否存在
        """
        if not cls._connected:
            raise RuntimeError("Cache 未连接，请先调用 connect()")
        namespace, real_key = cls._split_key(key)
        entry = await CacheEntry.filter(namespace=namespace, key=real_key).first()
        if not entry:
            return False
        if entry.expires_at and entry.expires_at <= datetime.now():
            await entry.delete()
            return False
        return True

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
        if not cls._connected:
            raise RuntimeError("Cache 未连接，请先调用 connect()")
        namespace, real_key = cls._split_key(key)
        updated = await CacheEntry.filter(namespace=namespace, key=real_key).update(
            expires_at=datetime.now() + timedelta(seconds=seconds)
        )
        return updated > 0

    @staticmethod
    def _split_key(key: str) -> tuple[str, str]:
        parts = key.split(":", 2)
        if len(parts) >= 3:
            return f"{parts[0]}:{parts[1]}", parts[2]
        if len(parts) == 2:
            return parts[0], parts[1]
        return "default", key

    @staticmethod
    def _pattern_to_like(pattern: str) -> tuple[str, str]:
        namespace, key = Cache._split_key(pattern)
        return namespace, key.replace("*", "")


async def check_redis_connection() -> bool:
    """
    检查 Redis 连接状态

    用于健康检查，验证 Redis 是否可连接

    Returns:
        bool: True 如果连接正常，False 如果连接失败
    """
    try:
        return cache._connected
    except Exception as e:
        logger.warning(f"Cache 连接检查失败: {e}")
        return False


# 创建全局缓存实例
cache = Cache()
