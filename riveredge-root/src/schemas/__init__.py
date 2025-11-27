"""
RiverEdge Core - Pydantic Schema 模块
"""

from schemas.tenant import (
    TenantBase,
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantListResponse,
)
from schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
)
from schemas.role import (
    RoleBase,
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleListResponse,
)
from schemas.auth import (
    LoginRequest,
    LoginResponse,
    PersonalRegisterRequest,
    OrganizationRegisterRequest,
    RegisterResponse,
    TenantJoinRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
    CurrentUserResponse,
)
from schemas.permission import (
    PermissionBase,
    PermissionCreate,
    PermissionUpdate,
    PermissionResponse,
    PermissionListResponse,
)

__all__ = [
    # Tenant Schemas
    "TenantBase",
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    "TenantListResponse",
    # User Schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserListResponse",
    # Role Schemas
    "RoleBase",
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "RoleListResponse",
    # Auth Schemas
    "LoginRequest",
    "LoginResponse",
    "PersonalRegisterRequest",
    "OrganizationRegisterRequest",
    "RegisterResponse",
    "TenantJoinRequest",
    "TokenRefreshRequest",
    "TokenRefreshResponse",
    "CurrentUserResponse",
    # Permission Schemas
    "PermissionBase",
    "PermissionCreate",
    "PermissionUpdate",
    "PermissionResponse",
    "PermissionListResponse",
]
