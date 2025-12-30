"""
API 依赖模块

提供 API 路由所需的依赖注入函数。
"""

from .deps import get_current_user, get_current_tenant

__all__ = ["get_current_user", "get_current_tenant"]

