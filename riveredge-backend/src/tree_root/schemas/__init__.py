"""
系统级数据验证模块（Pydantic Schema）

包含所有系统级功能的 Schema 定义，用于请求/响应数据验证。
"""

# 角色权限 Schema
from .role import RoleCreate, RoleUpdate, RoleResponse, RoleListResponse
from .permission import PermissionResponse, PermissionListResponse

# 组织架构 Schema
from .department import DepartmentCreate, DepartmentUpdate, DepartmentResponse, DepartmentTreeResponse
from .position import PositionCreate, PositionUpdate, PositionResponse, PositionListResponse

# 账户 Schema（扩展）
from .user import UserCreate, UserUpdate, UserResponse, UserListResponse, UserImport, UserExport

__all__ = [
    # 角色权限 Schema
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "RoleListResponse",
    "PermissionResponse",
    "PermissionListResponse",
    # 组织架构 Schema
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "DepartmentTreeResponse",
    "PositionCreate",
    "PositionUpdate",
    "PositionResponse",
    "PositionListResponse",
    # 账户 Schema
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserListResponse",
    "UserImport",
    "UserExport",
]

