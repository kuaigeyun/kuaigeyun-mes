"""
缓存管理器模块

提供多级缓存策略、缓存预热、缓存监控等高级缓存功能
"""

import asyncio
import json
from typing import Optional, Dict, Any, List, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from loguru import logger

from core.cache.cache import Cache, cache
from core.exceptions.exceptions import CacheError


@dataclass
class CacheStats:
    """缓存统计信息"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    errors: int = 0

    @property
    def hit_rate(self) -> float:
        """缓存命中率"""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


@dataclass
class CacheConfig:
    """缓存配置"""
    key_prefix: str = "riveredge"
    default_ttl: int = 3600  # 默认1小时
    max_ttl: int = 86400  # 最大24小时
    enable_monitoring: bool = True
    enable_compression: bool = False


class CacheManager:
    """
    缓存管理器

    提供高级缓存功能：
    - 多级缓存策略
    - 缓存预热
    - 缓存监控
    - 缓存失效策略
    """

    def __init__(self, config: Optional[CacheConfig] = None):
        """
        初始化缓存管理器

        Args:
            config: 缓存配置
        """
        self.config = config or CacheConfig()
        self.stats = CacheStats()
        self._warmup_tasks: Dict[str, Dict[str, Any]] = {}

    def _make_key(self, namespace: str, key: str) -> str:
        """
        生成缓存键

        Args:
            namespace: 命名空间
            key: 原始键

        Returns:
            str: 完整的缓存键
        """
        return f"{self.config.key_prefix}:{namespace}:{key}"

    async def get(
        self,
        namespace: str,
        key: str,
        default: Any = None
    ) -> Any:
        """
        获取缓存值

        Args:
            namespace: 命名空间
            key: 缓存键
            default: 默认值

        Returns:
            Any: 缓存值或默认值
        """
        try:
            cache_key = self._make_key(namespace, key)
            value = await cache.get(cache_key)

            if value is not None:
                self.stats.hits += 1
                # 如果启用了压缩，需要解压
                if self.config.enable_compression:
                    value = self._decompress(value)
                # 解析JSON
                return json.loads(value)
            else:
                self.stats.misses += 1
                return default

        except Exception as e:
            logger.warning(f"缓存获取失败: {e}")
            self.stats.errors += 1
            return default

    async def set(
        self,
        namespace: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """
        设置缓存值

        Args:
            namespace: 命名空间
            key: 缓存键
            value: 缓存值
            ttl: 过期时间（秒）

        Returns:
            bool: 是否设置成功
        """
        try:
            cache_key = self._make_key(namespace, key)
            ttl = ttl or self.config.default_ttl

            # 限制最大TTL
            if ttl > self.config.max_ttl:
                ttl = self.config.max_ttl

            # 序列化为JSON
            serialized_value = json.dumps(value)

            # 如果启用了压缩，进行压缩
            if self.config.enable_compression:
                serialized_value = self._compress(serialized_value)

            success = await cache.set(cache_key, serialized_value, ttl)

            if success:
                self.stats.sets += 1
            else:
                self.stats.errors += 1

            return success

        except Exception as e:
            logger.warning(f"缓存设置失败: {e}")
            self.stats.errors += 1
            return False

    async def delete(self, namespace: str, key: str) -> bool:
        """
        删除缓存

        Args:
            namespace: 命名空间
            key: 缓存键

        Returns:
            bool: 是否删除成功
        """
        try:
            cache_key = self._make_key(namespace, key)
            result = await cache.delete(cache_key)

            if result > 0:
                self.stats.deletes += 1
                return True
            else:
                return False

        except Exception as e:
            logger.warning(f"缓存删除失败: {e}")
            self.stats.errors += 1
            return False

    async def exists(self, namespace: str, key: str) -> bool:
        """
        检查缓存是否存在

        Args:
            namespace: 命名空间
            key: 缓存键

        Returns:
            bool: 是否存在
        """
        try:
            cache_key = self._make_key(namespace, key)
            return await cache.exists(cache_key)
        except Exception as e:
            logger.warning(f"缓存检查失败: {e}")
            self.stats.errors += 1
            return False

    async def expire(self, namespace: str, key: str, ttl: int) -> bool:
        """
        设置缓存过期时间

        Args:
            namespace: 命名空间
            key: 缓存键
            ttl: 过期时间（秒）

        Returns:
            bool: 是否设置成功
        """
        try:
            cache_key = self._make_key(namespace, key)
            return await cache.expire(cache_key, ttl)
        except Exception as e:
            logger.warning(f"缓存过期设置失败: {e}")
            self.stats.errors += 1
            return False

    async def clear_namespace(self, namespace: str) -> int:
        """
        清空命名空间下的所有缓存

        Args:
            namespace: 命名空间

        Returns:
            int: 删除的键数量
        """
        # 注意：Redis 不支持直接删除命名空间下的所有键
        # 这里返回0表示不支持此操作
        logger.warning(f"Redis 不支持直接清空命名空间: {namespace}")
        return 0

    async def get_or_set(
        self,
        namespace: str,
        key: str,
        func: Callable[[], Awaitable[Any]],
        ttl: Optional[int] = None
    ) -> Any:
        """
        获取缓存值，如果不存在则设置

        Args:
            namespace: 命名空间
            key: 缓存键
            func: 获取值的函数
            ttl: 过期时间（秒）

        Returns:
            Any: 缓存值
        """
        # 先尝试获取缓存
        value = await self.get(namespace, key)
        if value is not None:
            return value

        # 缓存不存在，调用函数获取值
        try:
            value = await func()
            # 设置缓存
            await self.set(namespace, key, value, ttl)
            return value
        except Exception as e:
            logger.error(f"缓存回源失败: {e}")
            raise

    def register_warmup_task(
        self,
        name: str,
        func: Callable[[], Awaitable[None]],
        interval: int = 3600,
        enabled: bool = True
    ):
        """
        注册缓存预热任务

        Args:
            name: 任务名称
            func: 预热函数
            interval: 执行间隔（秒）
            enabled: 是否启用
        """
        self._warmup_tasks[name] = {
            "func": func,
            "interval": interval,
            "enabled": enabled,
            "last_run": None,
            "next_run": datetime.now(),
        }

    async def run_warmup_tasks(self):
        """
        执行缓存预热任务
        """
        now = datetime.now()

        for name, task in self._warmup_tasks.items():
            if not task["enabled"]:
                continue

            if now >= task["next_run"]:
                try:
                    logger.info(f"执行缓存预热任务: {name}")
                    await task["func"]()
                    task["last_run"] = now
                    task["next_run"] = now + timedelta(seconds=task["interval"])
                    logger.info(f"缓存预热任务完成: {name}")
                except Exception as e:
                    logger.error(f"缓存预热任务失败: {name} - {e}")

    def get_stats(self) -> Dict[str, Any]:
        """
        获取缓存统计信息

        Returns:
            Dict[str, Any]: 统计信息
        """
        return {
            "hits": self.stats.hits,
            "misses": self.stats.misses,
            "sets": self.stats.sets,
            "deletes": self.stats.deletes,
            "errors": self.stats.errors,
            "hit_rate": self.stats.hit_rate,
            "warmup_tasks": {
                name: {
                    "enabled": task["enabled"],
                    "interval": task["interval"],
                    "last_run": task["last_run"].isoformat() if task["last_run"] else None,
                    "next_run": task["next_run"].isoformat(),
                }
                for name, task in self._warmup_tasks.items()
            }
        }

    def _compress(self, data: str) -> str:
        """
        压缩数据（占位符实现）

        Args:
            data: 原始数据

        Returns:
            str: 压缩后的数据
        """
        # TODO: 实现实际的压缩算法，如gzip
        return data

    def _decompress(self, data: str) -> str:
        """
        解压数据（占位符实现）

        Args:
            data: 压缩数据

        Returns:
            str: 解压后的数据
        """
        # TODO: 实现实际的解压算法
        return data


# 创建全局缓存管理器实例
cache_manager = CacheManager()


# 便捷函数

async def cached(
    namespace: str,
    key: str,
    ttl: Optional[int] = None
) -> Callable:
    """
    缓存装饰器

    Args:
        namespace: 命名空间
        key: 缓存键
        ttl: 过期时间（秒）

    Returns:
        Callable: 装饰器函数
    """
    def decorator(func: Callable[[], Awaitable[Any]]) -> Callable[[], Awaitable[Any]]:
        async def wrapper(*args, **kwargs) -> Any:
            cache_key = f"{func.__name__}:{key}"
            return await cache_manager.get_or_set(namespace, cache_key, func, ttl)
        return wrapper
    return decorator


async def invalidate_cache(namespace: str, key: str) -> bool:
    """
    使缓存失效

    Args:
        namespace: 命名空间
        key: 缓存键

    Returns:
        bool: 是否成功
    """
    return await cache_manager.delete(namespace, key)
