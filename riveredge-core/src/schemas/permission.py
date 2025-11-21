"""
权限 Schema 模块

定义权限相关的 Pydantic Schema，用于 API 请求和响应验证
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class PermissionBase(BaseModel):
    """
    权限基础 Schema
    
    包含权限的基本字段，用于创建和更新操作。
    """
    
    name: str = Field(..., min_length=1, max_length=50, description="权限名称（1-50 字符）")
    code: str = Field(..., min_length=1, max_length=100, description="权限代码（1-100 字符，格式：resource:action）")
    description: Optional[str] = Field(None, description="权限描述（可选）")
    resource: str = Field(..., min_length=1, max_length=50, description="资源名称（如：user, role, tenant）")
    action: str = Field(..., min_length=1, max_length=50, description="操作类型（如：create, read, update, delete）")
    is_system: bool = Field(default=False, description="是否为系统权限（系统权限不可删除）")


class PermissionCreate(PermissionBase):
    """
    权限创建 Schema
    
    用于创建新权限的请求数据。
    
    Attributes:
        name: 权限名称（必填，1-50 字符）
        code: 权限代码（必填，1-100 字符，组织内唯一）
        description: 权限描述（可选）
        resource: 资源名称（必填）
        action: 操作类型（必填）
        tenant_id: 组织 ID（必填，用于多组织隔离）
        is_system: 是否为系统权限（默认 False）
    """
    
    tenant_id: int = Field(..., description="组织 ID（用于多组织隔离）")


class PermissionUpdate(BaseModel):
    """
    权限更新 Schema
    
    用于更新权限信息的请求数据。所有字段都是可选的。
    
    Attributes:
        name: 权限名称（可选，1-50 字符）
        code: 权限代码（可选，1-100 字符）
        description: 权限描述（可选）
        resource: 资源名称（可选）
        action: 操作类型（可选）
        is_system: 是否为系统权限（可选，注意：系统权限不可删除）
    """
    
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="权限名称（1-50 字符）")
    code: Optional[str] = Field(None, min_length=1, max_length=100, description="权限代码（1-100 字符）")
    description: Optional[str] = Field(None, description="权限描述（可选）")
    resource: Optional[str] = Field(None, min_length=1, max_length=50, description="资源名称")
    action: Optional[str] = Field(None, min_length=1, max_length=50, description="操作类型")
    is_system: Optional[bool] = Field(None, description="是否为系统权限（注意：系统权限不可删除）")


class PermissionResponse(PermissionBase):
    """
    权限响应 Schema
    
    用于返回权限信息的响应数据。
    
    Attributes:
        id: 权限 ID
        tenant_id: 组织 ID
        name: 权限名称
        code: 权限代码
        description: 权限描述
        resource: 资源名称
        action: 操作类型
        is_system: 是否为系统权限
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="权限 ID")
    tenant_id: int = Field(..., description="组织 ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class PermissionListResponse(BaseModel):
    """
    权限列表响应 Schema
    
    用于返回权限列表的响应数据。
    
    Attributes:
        items: 权限列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    
    items: List[PermissionResponse] = Field(..., description="权限列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")

