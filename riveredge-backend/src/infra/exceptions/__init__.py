"""
异常处理模块

定义所有业务异常类和错误处理机制
"""

from infra.exceptions.exceptions import (
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

__all__ = [
    "RiverEdgeException",
    "ValidationError",
    "NotFoundError",
    "UnauthorizedError",
    "PermissionDeniedError",
    "RateLimitError",
    "CacheError",
    "DatabaseError",
    "create_error_response",
]

