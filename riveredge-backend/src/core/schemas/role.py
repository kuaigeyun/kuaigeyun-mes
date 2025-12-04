"""
角色 Schema 模块

定义角色相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class RoleBase(BaseModel):
    """
    角色基础 Schema
    
    包含角色的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="角色名称")
    code: str = Field(..., min_length=1, max_length=50, description="角色代码（唯一，用于程序识别）")
    description: Optional[str] = Field(None, description="角色描述")
    is_active: bool = Field(default=True, description="是否启用")


class RoleCreate(RoleBase):
    """
    角色创建 Schema
    
    用于创建新角色的请求数据。
    
    Attributes:
        name: 角色名称（必填，1-100 字符）
        code: 角色代码（必填，1-50 字符，组织内唯一）
        description: 角色描述（可选）
        is_active: 是否启用（默认 True）
    """
    pass


class RoleUpdate(BaseModel):
    """
    角色更新 Schema
    
    用于更新角色的请求数据，所有字段可选。
    
    Attributes:
        name: 角色名称（可选，1-100 字符）
        code: 角色代码（可选，1-50 字符，组织内唯一）
        description: 角色描述（可选）
        is_active: 是否启用（可选）
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="角色名称")
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="角色代码（唯一，用于程序识别）")
    description: Optional[str] = Field(None, description="角色描述")
    is_active: Optional[bool] = Field(None, description="是否启用")


class PermissionInfo(BaseModel):
    """
    权限信息 Schema
    
    用于在角色详情中返回关联的权限信息。
    """
    id: int = Field(..., description="权限ID（内部使用）")
    uuid: str = Field(..., description="权限UUID（对外暴露）")
    name: str = Field(..., description="权限名称")
    code: str = Field(..., description="权限代码")
    resource: str = Field(..., description="资源（模块）")
    action: str = Field(..., description="操作")
    permission_type: str = Field(..., description="权限类型")
    
    model_config = ConfigDict(from_attributes=True)


class RoleResponse(RoleBase):
    """
    角色响应 Schema

    用于返回角色详细信息，包括关联的权限列表。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID，不暴露内部ID。

    Attributes:
        uuid: 角色UUID（对外暴露，业务标识）
        tenant_id: 组织ID
        is_system: 是否系统角色
        permissions: 关联的权限列表
        permission_count: 关联的权限数量
        user_count: 关联的用户数量
        created_at: 创建时间
        updated_at: 更新时间
    """
    uuid: str = Field(..., description="角色UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    is_system: bool = Field(..., description="是否系统角色（系统角色不可删除）")
    permissions: Optional[List[PermissionInfo]] = Field(None, description="关联的权限列表")
    permission_count: Optional[int] = Field(None, description="关联的权限数量")
    user_count: Optional[int] = Field(None, description="关联的用户数量")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True)


class RoleListItem(BaseModel):
    """
    角色列表项 Schema

    用于角色列表响应，不包含关联的权限列表（性能优化）。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。
    """
    uuid: str = Field(..., description="角色UUID（对外暴露，业务标识）")
    name: str = Field(..., description="角色名称")
    code: str = Field(..., description="角色代码")
    description: Optional[str] = Field(None, description="角色描述")
    is_system: bool = Field(..., description="是否系统角色")
    is_active: bool = Field(..., description="是否启用")
    permission_count: int = Field(..., description="关联的权限数量")
    user_count: int = Field(..., description="关联的用户数量")
    created_at: datetime = Field(..., description="创建时间")

    model_config = ConfigDict(from_attributes=True)


class RoleListResponse(BaseModel):
    """
    角色列表响应 Schema
    
    用于返回角色列表，包含分页信息。
    """
    items: List[RoleListItem] = Field(..., description="角色列表")
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class RolePermissionAssign(BaseModel):
    """
    角色权限分配 Schema
    
    用于分配角色权限的请求数据。
    
    Attributes:
        permission_uuids: 权限UUID列表（使用UUID而不是ID）
    """
    permission_uuids: List[str] = Field(..., description="权限UUID列表（使用UUID而不是ID）")

