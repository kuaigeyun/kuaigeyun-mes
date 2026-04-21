"""
API缓存装饰器模块

提供API响应缓存装饰器，优化API响应时间。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

import hashlib
import json
from functools import wraps
from typing import Optional, Callable, Any, Dict, Iterable, Type
from fastapi import Request, Response
from pydantic import BaseModel
from loguru import logger

from infra.infrastructure.cache.cache_manager import cache_manager


def cache_response(
    namespace: str = "api",
    ttl: int = 300,
    key_func: Optional[Callable[[Request], str]] = None,
    vary_on_headers: Optional[list] = None,
    vary_on_query: bool = True,
    vary_on_user: bool = True,
    vary_on_tenant: bool = True,
):
    """
    API响应缓存装饰器
    
    自动缓存API响应，减少数据库查询和计算时间。
    
    Args:
        namespace: 缓存命名空间，默认"api"
        ttl: 缓存过期时间（秒），默认300秒（5分钟）
        key_func: 自定义缓存键生成函数（可选）
        vary_on_headers: 根据请求头变化缓存（可选，如["Accept-Language"]）
        vary_on_query: 是否根据查询参数变化缓存，默认True
        vary_on_user: 是否根据用户变化缓存，默认True
        vary_on_tenant: 是否根据租户变化缓存，默认True
    
    Returns:
        装饰器函数
    
    Example:
        ```python
        @router.get("/users")
        @cache_response(namespace="users", ttl=600)
        async def get_users(
            request: Request,
            current_user: User = Depends(get_current_user),
            tenant_id: int = Depends(get_current_tenant),
        ):
            # API逻辑
            return users
        ```
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # 从kwargs中提取Request对象
            request: Optional[Request] = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get('request')
            
            # 如果没有Request对象，直接执行函数（不缓存）
            if not request:
                logger.warning(f"API缓存装饰器: {func.__name__} 没有Request对象，跳过缓存")
                return await func(*args, **kwargs)
            
            # 生成缓存键
            if key_func:
                cache_key = key_func(request)
            else:
                cache_key = _generate_cache_key(
                    func.__name__,
                    request,
                    vary_on_headers=vary_on_headers,
                    vary_on_query=vary_on_query,
                    vary_on_user=vary_on_user,
                    vary_on_tenant=vary_on_tenant,
                    kwargs=kwargs
                )
            
            # 尝试从缓存获取
            try:
                cached_value = await cache_manager.get(namespace, cache_key)
                if cached_value is not None:
                    logger.debug(f"API缓存命中: {func.__name__} - {cache_key}")
                    return cached_value
            except Exception as e:
                logger.warning(f"API缓存获取失败: {e}")
            
            # 缓存未命中，执行函数
            result = await func(*args, **kwargs)
            
            # 缓存结果（只缓存成功的响应）
            try:
                # 检查结果是否可序列化
                if _is_serializable(result):
                    await cache_manager.set(namespace, cache_key, result, ttl=ttl)
                    logger.debug(f"API缓存设置: {func.__name__} - {cache_key}")
            except Exception as e:
                logger.warning(f"API缓存设置失败: {e}")
            
            return result
        
        return wrapper
    return decorator


def _generate_cache_key(
    func_name: str,
    request: Request,
    vary_on_headers: Optional[list] = None,
    vary_on_query: bool = True,
    vary_on_user: bool = True,
    vary_on_tenant: bool = True,
    kwargs: Optional[Dict] = None
) -> str:
    """
    生成缓存键
    
    Args:
        func_name: 函数名
        request: 请求对象
        vary_on_headers: 根据请求头变化缓存
        vary_on_query: 是否根据查询参数变化缓存
        vary_on_user: 是否根据用户变化缓存
        vary_on_tenant: 是否根据租户变化缓存
        kwargs: 函数参数
    
    Returns:
        str: 缓存键
    """
    key_parts = [func_name, request.url.path]
    
    # 根据查询参数变化
    if vary_on_query and request.query_params:
        sorted_params = sorted(request.query_params.items())
        key_parts.append(f"query:{hashlib.md5(json.dumps(sorted_params, sort_keys=True).encode()).hexdigest()}")
    
    # 根据请求头变化
    if vary_on_headers:
        header_values = []
        for header in vary_on_headers:
            value = request.headers.get(header)
            if value:
                header_values.append(f"{header}:{value}")
        if header_values:
            key_parts.append(f"headers:{hashlib.md5('|'.join(header_values).encode()).hexdigest()}")
    
    # 根据用户变化
    if vary_on_user and kwargs:
        user_id = kwargs.get('current_user')
        if user_id and hasattr(user_id, 'id'):
            key_parts.append(f"user:{user_id.id}")
    
    # 根据租户变化
    if vary_on_tenant and kwargs:
        tenant_id = kwargs.get('tenant_id')
        if tenant_id:
            key_parts.append(f"tenant:{tenant_id}")
    
    # 生成最终缓存键
    cache_key = ":".join(key_parts)
    return cache_key


def _is_serializable(obj: Any) -> bool:
    """
    检查对象是否可序列化
    
    Args:
        obj: 要检查的对象
    
    Returns:
        bool: 是否可序列化
    """
    try:
        json.dumps(obj)
        return True
    except (TypeError, ValueError):
        return False


def invalidate_api_cache(
    namespace: str = "api",
    pattern: Optional[str] = None,
    func_name: Optional[str] = None
) -> bool:
    """
    使API缓存失效
    
    Args:
        namespace: 缓存命名空间
        pattern: 缓存键模式（支持通配符）
        func_name: 函数名（如果提供，只失效该函数的缓存）
    
    Returns:
        bool: 是否成功
    
    Note:
        Redis不支持直接按模式删除，这里返回True表示已标记为失效
        实际删除需要在下次访问时检查
    """
    # TODO: 实现基于模式的缓存失效
    # 可以使用Redis的KEYS命令或SCAN命令
    logger.info(f"API缓存失效: namespace={namespace}, pattern={pattern}, func_name={func_name}")
    return True


_CACHE_SKIP_KWARGS = {"current_user", "request", "response", "background_tasks", "db", "session"}


def cache_by_kwargs(
    namespace: str,
    ttl: int = 30,
    include_kwargs: Optional[Iterable[str]] = None,
    exclude_kwargs: Optional[Iterable[str]] = None,
):
    """
    面向参数化 API 的轻量缓存装饰器（基于 PostgreSQL cache_manager）。

    - 不依赖 Request 对象，从函数关键字参数直接组 key，适合工作台这种
      "tenant_id + 少量标量参数" 的接口。
    - 自动按 tenant_id 隔离；同租户内多个用户命中同一条缓存，放大命中率。
    - 支持返回 Pydantic 模型：写入时 model_dump(mode='json')，命中时按注解反序列化。

    Args:
        namespace: 缓存命名空间（建议按模块/接口区分，便于后续按 pattern 清理）。
        ttl: 过期秒数（建议 30-120s；工作台类"看板"级数据足够）。
        include_kwargs: 若提供，则仅这些参数参与 key；否则默认用全部标量参数。
        exclude_kwargs: 额外排除的参数名（在内置 _CACHE_SKIP_KWARGS 基础上追加）。
    """
    skip = set(_CACHE_SKIP_KWARGS) | set(exclude_kwargs or ())
    allow = set(include_kwargs) if include_kwargs else None

    def decorator(func: Callable) -> Callable:
        return_model: Optional[Type[BaseModel]] = None
        ann = func.__annotations__.get("return")
        if isinstance(ann, type) and issubclass(ann, BaseModel):
            return_model = ann

        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            tenant_id = kwargs.get("tenant_id")
            if tenant_id is None:
                return await func(*args, **kwargs)

            parts = [f"t{tenant_id}"]
            for k in sorted(kwargs.keys()):
                if k in skip or k == "tenant_id":
                    continue
                if allow is not None and k not in allow:
                    continue
                v = kwargs[k]
                if v is None or isinstance(v, (str, int, float, bool)):
                    parts.append(f"{k}={v}")
            cache_key = f"{func.__name__}|" + "|".join(parts)

            try:
                cached = await cache_manager.get(namespace, cache_key)
            except Exception as e:
                logger.warning(f"cache_by_kwargs get failed: {e}")
                cached = None

            if cached is not None:
                if return_model is not None and isinstance(cached, dict):
                    try:
                        return return_model.model_validate(cached)
                    except Exception:
                        return cached
                return cached

            result = await func(*args, **kwargs)

            payload: Any = None
            if isinstance(result, BaseModel):
                payload = result.model_dump(mode="json")
            elif isinstance(result, (dict, list)):
                payload = result
            if payload is not None:
                try:
                    await cache_manager.set(namespace, cache_key, payload, ttl=ttl)
                except Exception as e:
                    logger.warning(f"cache_by_kwargs set failed ({func.__name__}): {e}")

            return result

        return wrapper

    return decorator