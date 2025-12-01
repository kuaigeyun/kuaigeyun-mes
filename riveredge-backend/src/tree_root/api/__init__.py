"""
系统级 API 路由模块

包含所有系统级功能的 API 路由定义。
"""

# 角色权限 API
from .roles.roles import router as roles_router
from .permissions.permissions import router as permissions_router

# 组织架构 API
from .departments.departments import router as departments_router
from .positions.positions import router as positions_router

# 账户管理 API
from .users.users import router as users_router

__all__ = [
    "roles_router",
    "permissions_router",
    "departments_router",
    "positions_router",
    "users_router",
]

