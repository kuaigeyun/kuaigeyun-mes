"""
RiverEdge Core - 核心功能模块

提供向后兼容的导入路径
"""

# 向后兼容：保持原有的导入路径
from core.database import TORTOISE_ORM, register_db, check_db_connection, sync_database
from core.security import (
    create_access_token,
    get_token_payload,
    verify_token,
    hash_password,
    verify_password,
    create_token_for_superadmin,
    get_superadmin_token_payload,
    verify_superadmin_token,
)
from core.cache import Cache, cache, check_redis_connection, cache_manager
from core.middleware import APIGovernanceMiddleware, get_api_stats, reset_api_stats
from core.exceptions import (
    RiverEdgeException,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    PermissionDeniedError,
    RateLimitError,
    CacheError,
    DatabaseError,
    create_error_response,
)
from core.utils import (
    now,
    make_aware,
    make_naive,
    to_shanghai,
    to_utc,
    PYINYIN_AVAILABLE,
    get_pinyin_initials,
    is_pinyin_keyword,
    match_pinyin_initials,
    list_with_search,
    build_keyword_filter,
    SearchConfig,
    get_tenant_queryset,
    filter_by_tenant,
)
from core.context import (
    get_current_tenant_id,
    set_current_tenant_id,
    clear_tenant_context,
    require_tenant_context,
)

__all__ = [
    # 数据库
    "TORTOISE_ORM",
    "register_db",
    "check_db_connection",
    "sync_database",
    # 安全
    "create_access_token",
    "get_token_payload",
    "verify_token",
    "hash_password",
    "verify_password",
    "create_token_for_superadmin",
    "get_superadmin_token_payload",
    "verify_superadmin_token",
    # 缓存
    "Cache",
    "cache",
    "check_redis_connection",
    "cache_manager",
    # 中间件
    "APIGovernanceMiddleware",
    "get_api_stats",
    "reset_api_stats",
    # 异常
    "RiverEdgeException",
    "ValidationError",
    "NotFoundError",
    "UnauthorizedError",
    "PermissionDeniedError",
    "RateLimitError",
    "CacheError",
    "DatabaseError",
    "create_error_response",
    # 工具
    "now",
    "make_aware",
    "make_naive",
    "to_shanghai",
    "to_utc",
    "PYINYIN_AVAILABLE",
    "get_pinyin_initials",
    "is_pinyin_keyword",
    "match_pinyin_initials",
    "list_with_search",
    "build_keyword_filter",
    "SearchConfig",
    "get_tenant_queryset",
    "filter_by_tenant",
    # 上下文
    "get_current_tenant_id",
    "set_current_tenant_id",
    "clear_tenant_context",
    "require_tenant_context",
]
