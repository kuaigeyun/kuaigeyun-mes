"""
缓存模块

提供 Redis 缓存操作和管理功能
"""

from soil.infrastructure.cache.cache import Cache, cache, check_redis_connection
from soil.infrastructure.cache.cache_manager import cache_manager

__all__ = [
    "Cache",
    "cache",
    "check_redis_connection",
    "cache_manager",
]

