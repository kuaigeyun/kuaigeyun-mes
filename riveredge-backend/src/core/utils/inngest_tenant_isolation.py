"""
Inngest 函数租户隔离装饰器

提供统一的租户隔离处理，确保所有 Inngest 函数都正确实现多租户隔离。
"""

from functools import wraps
from typing import Callable, Any
from inngest import Event
from infra.domain.tenant_context import set_current_tenant_id, clear_tenant_context, get_current_tenant_id
from infra.models.tenant import Tenant
from loguru import logger


def with_tenant_isolation(func: Callable) -> Callable:
    """
    Inngest 函数租户隔离装饰器
    
    自动处理租户隔离：
    1. 从事件数据中获取 tenant_id
    2. 验证 tenant_id 的有效性
    3. 设置租户上下文
    4. 执行函数
    5. 清理租户上下文
    
    Args:
        func: Inngest 函数
    
    Returns:
        Callable: 包装后的函数
    
    Usage:
        @inngest_client.create_function(...)
        @with_tenant_isolation
        async def my_function(event: Event) -> Dict[str, Any]:
            # tenant_id 已经设置到上下文中
            # 可以直接使用 get_current_tenant_id() 获取
            tenant_id = get_current_tenant_id()
            # ... 业务逻辑
    """
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        # Inngest Python SDK 使用 handler(ctx=ctx, step=step) 调用，事件在 ctx.event
        ctx = (args[0] if args else None) or kwargs.get("ctx")
        event = getattr(ctx, "event", None) if ctx is not None else None
        if not event:
            event = kwargs.get("event")
        if not event:
            logger.error(f"Inngest 函数 {func.__name__} 缺少 event 参数")
            return {"success": False, "error": "缺少必要参数：event"}
        data = event.data or {}
        tenant_id = data.get("tenant_id")
        
        # 验证 tenant_id
        if not tenant_id:
            logger.error(f"Inngest 函数 {func.__name__} 缺少 tenant_id")
            return {
                "success": False,
                "error": "缺少必要参数：tenant_id"
            }
        
        # 验证 tenant_id 类型
        if not isinstance(tenant_id, int):
            try:
                tenant_id = int(tenant_id)
            except (ValueError, TypeError):
                logger.error(f"Inngest 函数 {func.__name__} tenant_id 类型错误: {tenant_id}")
                return {
                    "success": False,
                    "error": f"tenant_id 类型错误: {tenant_id}"
                }
        
        # 验证租户是否存在
        try:
            tenant = await Tenant.get_or_none(id=tenant_id)
            if not tenant:
                logger.error(f"Inngest 函数 {func.__name__} 租户不存在: {tenant_id}")
                return {
                    "success": False,
                    "error": f"租户不存在: {tenant_id}"
                }
            
            # 验证租户是否启用（如果租户模型有 is_active 字段）
            if hasattr(tenant, "is_active") and not tenant.is_active:
                logger.warning(f"Inngest 函数 {func.__name__} 租户已禁用: {tenant_id}")
                return {
                    "success": False,
                    "error": f"租户已禁用: {tenant_id}"
                }
        except Exception as e:
            logger.error(f"Inngest 函数 {func.__name__} 验证租户失败: {e}")
            return {
                "success": False,
                "error": f"验证租户失败: {str(e)}"
            }
        
        # 设置租户上下文
        set_current_tenant_id(tenant_id)
        
        try:
            # 执行函数：只传 event；过滤掉 Inngest 传入的 ctx/step，避免只接受 (event) 的 handler 报错
            filtered_kwargs = {k: v for k, v in kwargs.items() if k not in ("ctx", "step")}
            result = await func(event, **filtered_kwargs)
            return result
        except Exception as e:
            logger.error(f"Inngest 函数 {func.__name__} 执行失败: [租户 {tenant_id}] {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            # 清理租户上下文
            clear_tenant_context()
    
    return wrapper


def with_tenant_isolation_optional(func: Callable) -> Callable:
    """
    Inngest 函数租户隔离装饰器（可选）
    
    与 with_tenant_isolation 类似，但允许 tenant_id 为 None。
    适用于某些不需要租户隔离的场景（如平台级任务）。
    
    Args:
        func: Inngest 函数
    
    Returns:
        Callable: 包装后的函数
    
    Usage:
        @inngest_client.create_function(...)
        @with_tenant_isolation_optional
        async def my_function(event: Event) -> Dict[str, Any]:
            tenant_id = get_current_tenant_id()  # 可能为 None
            # ... 业务逻辑
    """
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        # Inngest Python SDK 使用 handler(ctx=ctx, step=step) 调用，事件在 ctx.event
        ctx = (args[0] if args else None) or kwargs.get("ctx")
        event = getattr(ctx, "event", None) if ctx is not None else None
        if not event:
            event = kwargs.get("event")
        if not event:
            logger.error(f"Inngest 函数 {func.__name__} 缺少 event 参数")
            return {"success": False, "error": "缺少必要参数：event"}
        data = event.data or {}
        tenant_id = data.get("tenant_id")
        
        # 如果提供了 tenant_id，则验证和设置
        if tenant_id is not None:
            # 验证 tenant_id 类型
            if not isinstance(tenant_id, int):
                try:
                    tenant_id = int(tenant_id)
                except (ValueError, TypeError):
                    logger.error(f"Inngest 函数 {func.__name__} tenant_id 类型错误: {tenant_id}")
                    return {
                        "success": False,
                        "error": f"tenant_id 类型错误: {tenant_id}"
                    }
            
            # 验证租户是否存在
            try:
                tenant = await Tenant.get_or_none(id=tenant_id)
                if not tenant:
                    logger.error(f"Inngest 函数 {func.__name__} 租户不存在: {tenant_id}")
                    return {
                        "success": False,
                        "error": f"租户不存在: {tenant_id}"
                    }
                
                # 验证租户是否启用
                if hasattr(tenant, "is_active") and not tenant.is_active:
                    logger.warning(f"Inngest 函数 {func.__name__} 租户已禁用: {tenant_id}")
                    return {
                        "success": False,
                        "error": f"租户已禁用: {tenant_id}"
                    }
                
                # 设置租户上下文
                set_current_tenant_id(tenant_id)
            except Exception as e:
                logger.error(f"Inngest 函数 {func.__name__} 验证租户失败: {e}")
                return {
                    "success": False,
                    "error": f"验证租户失败: {str(e)}"
                }
        
        try:
            # 执行函数：只传 event；过滤掉 Inngest 传入的 ctx/step
            filtered_kwargs = {k: v for k, v in kwargs.items() if k not in ("ctx", "step")}
            result = await func(event, **filtered_kwargs)
            return result
        except Exception as e:
            logger.error(f"Inngest 函数 {func.__name__} 执行失败: [租户 {tenant_id}] {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            # 清理租户上下文
            clear_tenant_context()
    
    return wrapper

