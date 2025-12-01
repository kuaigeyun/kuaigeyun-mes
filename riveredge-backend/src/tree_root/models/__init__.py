"""
系统级数据模型模块

包含所有系统级功能的数据模型定义。
"""

# 基础模型
from .base import BaseModel

# 角色权限模型
from .role import Role
from .permission import Permission, PermissionType
from .role_permission import RolePermission
from .user_role import UserRole

# 组织架构模型
from .department import Department
from .position import Position

__all__ = [
    # 基础模型
    "BaseModel",
    # 角色权限模型
    "Role",
    "Permission",
    "PermissionType",
    "RolePermission",
    "UserRole",
    # 组织架构模型
    "Department",
    "Position",
]

