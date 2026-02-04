"""
服务依赖注入

提供 FastAPI Depends 函数，用于依赖注入系统级服务。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Optional
from fastapi import Depends
from core.services.interfaces.service_registry import ServiceLocator
from core.services.interfaces.service_interface import (
    UserServiceInterface,
    RoleServiceInterface,
    MessageServiceInterface,
    ApplicationServiceInterface,
    UserActivityServiceInterface,
    AuditLogServiceInterface,
)
from core.services.interfaces.service_factory import (
    get_service_or_fallback,
    get_user_service as _get_user_service,
    get_role_service as _get_role_service,
    get_message_service as _get_message_service,
)


def get_user_service() -> Optional[UserServiceInterface]:
    """
    获取用户服务（依赖注入）
    
    ⚠️ 第三阶段改进：使用统一的服务获取方式，支持向后兼容
    
    Returns:
        Optional[UserServiceInterface]: 用户服务实例，如果未注册则返回 None
    """
    return _get_user_service()


def get_role_service() -> Optional[RoleServiceInterface]:
    """
    获取角色服务（依赖注入）
    
    Returns:
        Optional[RoleServiceInterface]: 角色服务实例，如果未注册则返回 None
    """
    return _get_role_service()


def get_message_service() -> Optional[MessageServiceInterface]:
    """
    获取消息服务（依赖注入）
    
    Returns:
        Optional[MessageServiceInterface]: 消息服务实例，如果未注册则返回 None
    """
    return _get_message_service()


def get_application_service() -> Optional[ApplicationServiceInterface]:
    """
    获取应用服务（依赖注入）
    
    Returns:
        Optional[ApplicationServiceInterface]: 应用服务实例，如果未注册则返回 None
    """
    try:
        return ServiceLocator.get_service("application_service")
    except Exception:
        return None


def get_user_activity_service() -> Optional[UserActivityServiceInterface]:
    """
    获取用户活动服务（依赖注入）
    
    Returns:
        Optional[UserActivityServiceInterface]: 用户活动服务实例，如果未注册则返回 None
    """
    try:
        return ServiceLocator.get_service("user_activity_service")
    except Exception:
        return None


def get_audit_log_service() -> Optional[AuditLogServiceInterface]:
    """
    获取审计日志服务（依赖注入）
    
    Returns:
        Optional[AuditLogServiceInterface]: 审计日志服务实例，如果未注册则返回 None
    """
    try:
        return ServiceLocator.get_service("audit_log_service")
    except Exception:
        return None

