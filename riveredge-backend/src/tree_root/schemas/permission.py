"""
权限 Schema 模块

定义权限相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class PermissionResponse(BaseModel):
    """
    权限响应 Schema

    用于返回权限详细信息，包括关联的角色列表。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。

    Attributes:
        uuid: 权限UUID（对外暴露，业务标识）
        tenant_id: 组织ID
        name: 权限名称
        code: 权限代码
        resource: 资源（模块）
        action: 操作
        description: 权限描述
        permission_type: 权限类型
        role_count: 关联的角色数量
        roles: 关联的角色列表
        created_at: 创建时间
        updated_at: 更新时间
    """
    uuid: str = Field(..., description="权限UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    name: str = Field(..., description="权限名称")
    code: str = Field(..., description="权限代码（格式：资源:操作）")
    resource: str = Field(..., description="资源（模块，如 user、role）")
    action: str = Field(..., description="操作（如 create、read、update、delete）")
    description: Optional[str] = Field(None, description="权限描述")
    permission_type: str = Field(..., description="权限类型：function（功能权限）、data（数据权限）、field（字段权限）")
    role_count: Optional[int] = Field(None, description="关联的角色数量")
    roles: Optional[List[dict]] = Field(None, description="关联的角色列表")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class PermissionListItem(BaseModel):
    """
    权限列表项 Schema

    用于权限列表响应，不包含关联的角色列表（性能优化）。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。
    """
    uuid: str = Field(..., description="权限UUID（对外暴露，业务标识）")
    name: str = Field(..., description="权限名称")
    code: str = Field(..., description="权限代码")
    resource: str = Field(..., description="资源（模块）")
    action: str = Field(..., description="操作")
    permission_type: str = Field(..., description="权限类型")
    role_count: int = Field(..., description="关联的角色数量")
    created_at: datetime = Field(..., description="创建时间")

    model_config = ConfigDict(from_attributes=True)


class PermissionListResponse(BaseModel):
    """
    权限列表响应 Schema
    
    用于返回权限列表，包含分页信息。
    """
    items: List[PermissionListItem] = Field(..., description="权限列表")
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")

