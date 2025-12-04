"""
用户 Schema 模块

定义用户相关的 Pydantic Schema，用于 API 请求和响应验证
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, EmailStr, ConfigDict


class UserBase(BaseModel):
    """
    用户基础 Schema
    
    包含用户的基本字段，用于创建和更新操作。
    """
    
    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符）")
    email: Optional[EmailStr] = Field(None, description="用户邮箱（可选，符合中国用户使用习惯）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    is_active: bool = Field(default=True, description="是否激活")
    is_platform_admin: bool = Field(default=False, description="是否为平台管理（系统级超级管理员，需 tenant_id=None）")
    is_tenant_admin: bool = Field(default=False, description="是否为组织管理员")
    source: Optional[str] = Field(None, max_length=50, description="用户来源（invite_code, personal, organization等）")


class UserCreate(UserBase):
    """
    用户创建 Schema
    
    用于创建新用户的请求数据。
    
    Attributes:
        username: 用户名（必填，3-50 字符）
        email: 用户邮箱（可选，符合中国用户使用习惯）
        password: 密码（必填，最少 8 字符）
        full_name: 用户全名（可选）
        tenant_id: 组织 ID（必填，用于多组织隔离）
        is_active: 是否激活（默认 True）
        is_platform_admin: 是否为平台管理（默认 False）
        is_tenant_admin: 是否为组织管理员（默认 False）
    """
    
    password: str = Field(..., min_length=8, max_length=100, description="密码（最少 8 字符）")
    tenant_id: int = Field(..., description="组织 ID（用于多组织隔离）")


class UserUpdate(BaseModel):
    """
    用户更新 Schema
    
    用于更新用户信息的请求数据。所有字段都是可选的。
    
    Attributes:
        username: 用户名（可选，3-50 字符）
        email: 用户邮箱（可选，邮箱格式）
        password: 密码（可选，最少 8 字符）
        full_name: 用户全名（可选）
        is_active: 是否激活（可选）
        is_platform_admin: 是否为平台管理（可选）
        is_tenant_admin: 是否为组织管理员（可选）
    """
    
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="用户名（3-50 字符）")
    email: Optional[EmailStr] = Field(None, description="用户邮箱（邮箱格式）")
    password: Optional[str] = Field(None, min_length=8, max_length=100, description="密码（最少 8 字符）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    is_active: Optional[bool] = Field(None, description="是否激活")
    is_platform_admin: Optional[bool] = Field(None, description="是否为平台管理（系统级超级管理员，需 tenant_id=None）")
    is_tenant_admin: Optional[bool] = Field(None, description="是否为组织管理员")


class UserResponse(UserBase):
    """
    用户响应 Schema

    用于返回用户信息的响应数据。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。

    Attributes:
        uuid: 用户UUID（对外暴露，业务标识）
        tenant_id: 组织 ID
        username: 用户名
        email: 用户邮箱（可选）
        full_name: 用户全名
        is_active: 是否激活
        is_platform_admin: 是否为平台管理
        is_tenant_admin: 是否为组织管理员
        last_login: 最后登录时间
        created_at: 创建时间
        updated_at: 更新时间
    """

    uuid: str = Field(..., description="用户UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织 ID")
    last_login: Optional[datetime] = Field(None, description="最后登录时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """
    用户列表响应 Schema
    
    用于返回用户列表的响应数据。
    
    Attributes:
        items: 用户列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    
    items: List[UserResponse] = Field(..., description="用户列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")

