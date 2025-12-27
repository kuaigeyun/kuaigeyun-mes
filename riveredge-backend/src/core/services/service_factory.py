"""
服务工厂

提供统一的服务获取方式，支持依赖注入和直接导入两种模式。
确保向后兼容性。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import TypeVar, Type, Optional, Any
from core.services.interfaces.service_registry import ServiceLocator

T = TypeVar('T')


def get_service_or_fallback(
    service_name: str,
    service_type: Type[T],
    fallback_class: Optional[Type] = None
) -> Optional[T]:
    """
    获取服务，如果未注册则回退到直接导入
    
    ⚠️ 第三阶段改进：统一的服务获取方式，支持向后兼容
    
    Args:
        service_name: 服务名称
        service_type: 服务接口类型
        fallback_class: 回退类（如果服务未注册，使用此类）
        
    Returns:
        Optional[T]: 服务实例，如果未注册且无回退类则返回 None
        
    Example:
        # 方式1：使用注册的服务
        user_service = get_service_or_fallback(
            "user_service",
            UserServiceInterface,
            UserService
        )
        
        # 方式2：在API路由中使用
        @router.post("/users")
        async def create_user(
            user_service: Optional[UserServiceInterface] = Depends(
                lambda: get_service_or_fallback("user_service", UserServiceInterface, UserService)
            )
        ):
            if user_service:
                return await user_service.create_user(...)
            else:
                # 回退到直接导入
                from core.services.user.user_service import UserService
                return await UserService.create_user(...)
    """
    try:
        # 优先从注册表获取
        return ServiceLocator.get_service(service_name)
    except Exception:
        # 如果服务未注册，返回 None
        # 调用方可以回退到直接导入
        return None


def get_user_service() -> Optional[Any]:
    """
    获取用户服务（依赖注入）
    
    ⚠️ 第三阶段改进：统一的服务获取函数
    
    Returns:
        Optional[UserServiceInterface]: 用户服务实例，如果未注册则返回 None
    """
    from core.services.interfaces.service_interface import UserServiceInterface
    from core.services.user.user_service import UserService
    
    return get_service_or_fallback("user_service", UserServiceInterface, UserService)


def get_role_service() -> Optional[Any]:
    """
    获取角色服务（依赖注入）
    
    Returns:
        Optional[RoleServiceInterface]: 角色服务实例，如果未注册则返回 None
    """
    from core.services.interfaces.service_interface import RoleServiceInterface
    from core.services.authorization.role_service import RoleService
    
    return get_service_or_fallback("role_service", RoleServiceInterface, RoleService)


def get_message_service() -> Optional[Any]:
    """
    获取消息服务（依赖注入）
    
    Returns:
        Optional[MessageServiceInterface]: 消息服务实例，如果未注册则返回 None
    """
    from core.services.interfaces.service_interface import MessageServiceInterface
    from core.services.messaging.message_service import MessageService
    
    return get_service_or_fallback("message_service", MessageServiceInterface, MessageService)

