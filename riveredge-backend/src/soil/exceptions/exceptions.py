"""
统一异常处理模块

定义所有业务异常类和错误码，提供统一的错误处理机制
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException


class RiverEdgeException(Exception):
    """
    RiverEdge 基础异常类

    所有自定义异常都继承此类，提供统一的错误处理接口
    """

    def __init__(
        self,
        message: str,
        code: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        初始化异常

        Args:
            message: 错误消息
            code: 错误码
            status_code: HTTP 状态码
            details: 额外详细信息
        """
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ValidationError(RiverEdgeException):
    """数据验证错误"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "VALIDATION_ERROR", 422, details)


class AuthenticationError(RiverEdgeException):
    """认证错误"""

    def __init__(self, message: str = "认证失败", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTHENTICATION_ERROR", 401, details)


class AuthorizationError(RiverEdgeException):
    """授权错误"""

    def __init__(self, message: str = "权限不足", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTHORIZATION_ERROR", 403, details)


# 向后兼容别名
UnauthorizedError = AuthenticationError
PermissionDeniedError = AuthorizationError


class NotFoundError(RiverEdgeException):
    """资源不存在错误"""

    def __init__(self, resource: str, resource_id: Optional[str] = None):
        message = f"{resource}不存在"
        if resource_id:
            message = f"{resource} '{resource_id}' 不存在"
        details = {"resource": resource, "resource_id": resource_id}
        super().__init__(message, "NOT_FOUND", 404, details)


class ConflictError(RiverEdgeException):
    """资源冲突错误"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CONFLICT", 409, details)


class BusinessLogicError(RiverEdgeException):
    """业务逻辑错误"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "BUSINESS_LOGIC_ERROR", 400, details)


class TenantError(RiverEdgeException):
    """组织相关错误"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "TENANT_ERROR", 400, details)


class DatabaseError(RiverEdgeException):
    """数据库错误"""

    def __init__(self, message: str = "数据库操作失败", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "DATABASE_ERROR", 503, details)


class CacheError(RiverEdgeException):
    """缓存错误"""

    def __init__(self, message: str = "缓存操作失败", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CACHE_ERROR", 503, details)


class ExternalServiceError(RiverEdgeException):
    """外部服务错误"""

    def __init__(self, service: str, message: str, details: Optional[Dict[str, Any]] = None):
        details = details or {}
        details["service"] = service
        super().__init__(f"外部服务 {service} 错误: {message}", "EXTERNAL_SERVICE_ERROR", 502, details)


class ConfigurationError(RiverEdgeException):
    """配置错误"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CONFIGURATION_ERROR", 500, details)


class RateLimitError(RiverEdgeException):
    """请求频率限制错误"""

    def __init__(self, message: str = "请求过于频繁，请稍后再试", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "RATE_LIMIT_ERROR", 429, details)


# 便捷的异常工厂函数

def user_not_found(user_id: Optional[int] = None) -> NotFoundError:
    """用户不存在异常"""
    return NotFoundError("用户", str(user_id) if user_id else None)


def tenant_not_found(tenant_id: Optional[int] = None) -> NotFoundError:
    """组织不存在异常"""
    return NotFoundError("组织", str(tenant_id) if tenant_id else None)


def role_not_found(role_id: Optional[int] = None) -> NotFoundError:
    """角色不存在异常"""
    return NotFoundError("角色", str(role_id) if role_id else None)


def permission_not_found(permission_id: Optional[int] = None) -> NotFoundError:
    """权限不存在异常"""
    return NotFoundError("权限", str(permission_id) if permission_id else None)


def email_already_exists(email: str) -> ConflictError:
    """邮箱已存在异常"""
    return ConflictError(f"邮箱 '{email}' 已被使用", {"email": email})


def username_already_exists(username: str) -> ConflictError:
    """用户名已存在异常"""
    return ConflictError(f"用户名 '{username}' 已被使用", {"username": username})


def tenant_domain_already_exists(domain: str) -> ConflictError:
    """组织域名已存在异常"""
    return ConflictError(f"域名 '{domain}' 已被使用", {"domain": domain})


def invalid_credentials() -> AuthenticationError:
    """无效凭据异常"""
    return AuthenticationError("用户名或密码错误")


def token_expired() -> AuthenticationError:
    """令牌过期异常"""
    return AuthenticationError("登录已过期，请重新登录")


def insufficient_permissions(required_permissions: list = None) -> AuthorizationError:
    """权限不足异常"""
    details = {}
    if required_permissions:
        details["required_permissions"] = required_permissions
    return AuthorizationError("权限不足", details)


def tenant_context_missing() -> TenantError:
    """组织上下文缺失异常"""
    return TenantError("组织上下文未设置，无法执行多组织操作")


def database_connection_error(details: Optional[Dict[str, Any]] = None) -> DatabaseError:
    """数据库连接错误"""
    return DatabaseError("数据库连接失败", details)


def redis_connection_error(details: Optional[Dict[str, Any]] = None) -> CacheError:
    """Redis 连接错误"""
    return CacheError("Redis 连接失败", details)


# 错误响应模型

def create_error_response(
    exception: RiverEdgeException,
    request_path: Optional[str] = None,
    trace_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    创建统一的错误响应

    Args:
        exception: 异常对象
        request_path: 请求路径
        trace_id: 跟踪 ID

    Returns:
        Dict[str, Any]: 统一的错误响应
    """
    response = {
        "success": False,
        "error": {
            "code": exception.code,
            "message": exception.message,
            "details": exception.details,
        },
        "timestamp": "2025-11-18T00:00:00Z"
    }

    if request_path:
        response["error"]["path"] = request_path

    if trace_id:
        response["trace_id"] = trace_id

    return response
