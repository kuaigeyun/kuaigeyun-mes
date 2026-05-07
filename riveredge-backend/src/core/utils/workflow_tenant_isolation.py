"""
工作流函数租户隔离装饰器。
"""

from functools import wraps
from typing import Any, Callable

from core.tasks.event_compat import Event
from infra.domain.tenant_context import clear_tenant_context, set_current_tenant_id
from infra.models.tenant import Tenant
from loguru import logger


def with_tenant_isolation(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        ctx = (args[0] if args else None) or kwargs.get("ctx")
        event = getattr(ctx, "event", None) if ctx is not None else None
        if not event:
            event = kwargs.get("event")
        if not event:
            logger.error(f"工作流函数 {func.__name__} 缺少 event 参数")
            return {"success": False, "error": "缺少必要参数：event"}

        data = event.data or {}
        tenant_id = data.get("tenant_id")
        if not tenant_id:
            logger.error(f"工作流函数 {func.__name__} 缺少 tenant_id")
            return {"success": False, "error": "缺少必要参数：tenant_id"}

        if not isinstance(tenant_id, int):
            try:
                tenant_id = int(tenant_id)
            except (ValueError, TypeError):
                logger.error(f"工作流函数 {func.__name__} tenant_id 类型错误: {tenant_id}")
                return {"success": False, "error": f"tenant_id 类型错误: {tenant_id}"}

        try:
            tenant = await Tenant.get_or_none(id=tenant_id)
            if not tenant:
                logger.error(f"工作流函数 {func.__name__} 租户不存在: {tenant_id}")
                return {"success": False, "error": f"租户不存在: {tenant_id}"}
            if hasattr(tenant, "is_active") and not tenant.is_active:
                logger.warning(f"工作流函数 {func.__name__} 租户已禁用: {tenant_id}")
                return {"success": False, "error": f"租户已禁用: {tenant_id}"}
        except Exception as e:
            logger.error(f"工作流函数 {func.__name__} 验证租户失败: {e}")
            return {"success": False, "error": f"验证租户失败: {str(e)}"}

        set_current_tenant_id(tenant_id)
        try:
            filtered_kwargs = {k: v for k, v in kwargs.items() if k not in ("ctx", "step")}
            return await func(event, **filtered_kwargs)
        except Exception as e:
            logger.error(f"工作流函数 {func.__name__} 执行失败: [租户 {tenant_id}] {e}")
            return {"success": False, "error": str(e)}
        finally:
            clear_tenant_context()

    return wrapper


def with_tenant_isolation_optional(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        ctx = (args[0] if args else None) or kwargs.get("ctx")
        event = getattr(ctx, "event", None) if ctx is not None else None
        if not event:
            event = kwargs.get("event")
        if not event:
            logger.error(f"工作流函数 {func.__name__} 缺少 event 参数")
            return {"success": False, "error": "缺少必要参数：event"}

        data = event.data or {}
        tenant_id = data.get("tenant_id")
        if tenant_id is not None:
            if not isinstance(tenant_id, int):
                try:
                    tenant_id = int(tenant_id)
                except (ValueError, TypeError):
                    logger.error(f"工作流函数 {func.__name__} tenant_id 类型错误: {tenant_id}")
                    return {"success": False, "error": f"tenant_id 类型错误: {tenant_id}"}
            try:
                tenant = await Tenant.get_or_none(id=tenant_id)
                if not tenant:
                    logger.error(f"工作流函数 {func.__name__} 租户不存在: {tenant_id}")
                    return {"success": False, "error": f"租户不存在: {tenant_id}"}
                if hasattr(tenant, "is_active") and not tenant.is_active:
                    logger.warning(f"工作流函数 {func.__name__} 租户已禁用: {tenant_id}")
                    return {"success": False, "error": f"租户已禁用: {tenant_id}"}
                set_current_tenant_id(tenant_id)
            except Exception as e:
                logger.error(f"工作流函数 {func.__name__} 验证租户失败: {e}")
                return {"success": False, "error": f"验证租户失败: {str(e)}"}

        try:
            filtered_kwargs = {k: v for k, v in kwargs.items() if k not in ("ctx", "step")}
            return await func(event, **filtered_kwargs)
        except Exception as e:
            logger.error(f"工作流函数 {func.__name__} 执行失败: [租户 {tenant_id}] {e}")
            return {"success": False, "error": str(e)}
        finally:
            clear_tenant_context()

    return wrapper


__all__ = ["with_tenant_isolation", "with_tenant_isolation_optional", "Event"]

