"""
服务辅助函数

提供API路由中使用的服务获取辅助函数，支持依赖注入和向后兼容。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Optional, Callable, Any
from core.services.interfaces.service_interface import UserServiceInterface
from core.services.user.user_service import UserService


def get_user_service_with_fallback() -> Any:
    """
    获取用户服务，如果未注册则回退到直接导入
    
    ⚠️ 第三阶段改进：统一的服务获取方式，确保向后兼容
    
    Returns:
        用户服务实例（UserServiceImpl）或适配器对象（向后兼容）
        
    Usage:
        @router.post("/users")
        async def create_user(
            user_service: Any = Depends(get_user_service_with_fallback)
        ):
            # 统一调用方式：user_service.create_user(...)
            return await user_service.create_user(...)
    """
    from core.services.interfaces.service_registry import ServiceLocator
    
    try:
        # 优先使用注册的服务（接口实现）
        service = ServiceLocator.get_service("user_service")
        if service:
            return service
    except Exception:
        pass
    
    # 回退到直接导入（向后兼容）
    # 创建一个适配器对象，将静态方法调用转换为实例方法调用
    class UserServiceAdapter:
        """UserService 适配器，将静态方法适配为实例方法"""
        async def create_user(self, tenant_id: int, data: Any, current_user_id: int):
            return await UserService.create_user(tenant_id, data, current_user_id)
        
        async def get_user_by_uuid(self, tenant_id: int, uuid: str):
            return await UserService.get_user_by_uuid(tenant_id, uuid)
        
        async def get_user_list(
            self,
            tenant_id: int,
            page: int = 1,
            page_size: int = 20,
            keyword: Optional[str] = None,
            department_uuid: Optional[str] = None,
            position_uuid: Optional[str] = None,
            is_active: Optional[bool] = None,
            is_tenant_admin: Optional[bool] = None,
            current_user_id: Optional[int] = None
        ):
            return await UserService.get_user_list(
                tenant_id=tenant_id,
                page=page,
                page_size=page_size,
                keyword=keyword,
                department_uuid=department_uuid,
                position_uuid=position_uuid,
                is_active=is_active,
                is_tenant_admin=is_tenant_admin,
                current_user_id=current_user_id
            )
    
    return UserServiceAdapter()


def get_role_service_with_fallback() -> Any:
    """
    获取角色服务，如果未注册则回退到直接导入
    
    Returns:
        角色服务实例或类
    """
    from core.services.interfaces.service_registry import ServiceLocator
    from core.services.authorization.role_service import RoleService
    
    try:
        service = ServiceLocator.get_service("role_service")
        if service:
            return service
    except Exception:
        pass
    
    return RoleService


def get_message_service_with_fallback() -> Any:
    """
    获取消息服务，如果未注册则回退到直接导入
    
    Returns:
        消息服务实例或类
    """
    from core.services.interfaces.service_registry import ServiceLocator
    from core.services.messaging.message_service import MessageService
    
    try:
        service = ServiceLocator.get_service("message_service")
        if service:
            return service
    except Exception:
        pass
    
    return MessageService

