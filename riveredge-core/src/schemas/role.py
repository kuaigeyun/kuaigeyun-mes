"""
角色 Schema 模块

定义角色相关的 Pydantic Schema，用于 API 请求和响应验证
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class RoleBase(BaseModel):
    """
    角色基础 Schema
    
    包含角色的基本字段，用于创建和更新操作。
    """
    
    name: str = Field(..., min_length=1, max_length=50, description="角色名称（1-50 字符）")
    code: str = Field(..., min_length=1, max_length=50, description="角色代码（1-50 字符，用于程序识别）")
    description: Optional[str] = Field(None, description="角色描述（可选）")
    is_system: bool = Field(default=False, description="是否为系统角色（系统角色不可删除）")


class RoleCreate(RoleBase):
    """
    角色创建 Schema
    
    用于创建新角色的请求数据。
    
    Attributes:
        name: 角色名称（必填，1-50 字符）
        code: 角色代码（必填，1-50 字符，组织内唯一）
        description: 角色描述（可选）
        tenant_id: 组织 ID（必填，用于多组织隔离）
        is_system: 是否为系统角色（默认 False）
    """
    
    tenant_id: int = Field(..., description="组织 ID（用于多组织隔离）")


class RoleUpdate(BaseModel):
    """
    角色更新 Schema
    
    用于更新角色信息的请求数据。所有字段都是可选的。
    
    Attributes:
        name: 角色名称（可选，1-50 字符）
        code: 角色代码（可选，1-50 字符）
        description: 角色描述（可选）
        is_system: 是否为系统角色（可选，注意：系统角色不可删除）
    """
    
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="角色名称（1-50 字符）")
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="角色代码（1-50 字符）")
    description: Optional[str] = Field(None, description="角色描述（可选）")
    is_system: Optional[bool] = Field(None, description="是否为系统角色（注意：系统角色不可删除）")


class RoleResponse(RoleBase):
    """
    角色响应 Schema
    
    用于返回角色信息的响应数据。
    
    Attributes:
        id: 角色 ID
        tenant_id: 组织 ID
        name: 角色名称
        code: 角色代码
        description: 角色描述
        is_system: 是否为系统角色
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="角色 ID")
    tenant_id: int = Field(..., description="组织 ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class RoleListResponse(BaseModel):
    """
    角色列表响应 Schema
    
    用于返回角色列表的响应数据。
    
    Attributes:
        items: 角色列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    
    items: List[RoleResponse] = Field(..., description="角色列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")

