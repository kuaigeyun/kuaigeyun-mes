"""
超级管理员 Schema 模块

定义超级管理员相关的 Pydantic Schema，用于 API 请求和响应的数据验证
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr, ConfigDict


class SuperAdminBase(BaseModel):
    """
    超级管理员基础 Schema
    
    包含超级管理员的通用字段定义
    
    Attributes:
        username: 用户名
        email: 用户邮箱（可选）
        full_name: 用户全名（可选）
        is_active: 是否激活
    """
    
    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符，全局唯一）")
    email: Optional[EmailStr] = Field(None, description="用户邮箱（可选，符合中国用户使用习惯）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    is_active: bool = Field(default=True, description="是否激活")


class SuperAdminCreate(SuperAdminBase):
    """
    超级管理员创建 Schema
    
    用于创建新超级管理员时的数据验证
    
    Attributes:
        username: 用户名（必填，3-50 字符，全局唯一）
        email: 用户邮箱（可选）
        password: 密码（必填，最少 8 字符）
        full_name: 用户全名（可选）
        is_active: 是否激活（可选，默认 True）
    """
    
    password: str = Field(..., min_length=8, max_length=100, description="密码（最少 8 字符）")


class SuperAdminUpdate(BaseModel):
    """
    超级管理员更新 Schema
    
    用于更新超级管理员信息时的数据验证。
    所有字段都是可选的，只更新提供的字段。
    
    Attributes:
        email: 用户邮箱（可选）
        full_name: 用户全名（可选）
        is_active: 是否激活（可选）
        password: 密码（可选，如果提供则更新密码）
    """
    
    email: Optional[EmailStr] = Field(None, description="用户邮箱（可选）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    is_active: Optional[bool] = Field(None, description="是否激活")
    password: Optional[str] = Field(None, min_length=8, max_length=100, description="密码（可选，最少 8 字符）")


class SuperAdminResponse(SuperAdminBase):
    """
    超级管理员响应 Schema
    
    用于 API 响应时的数据序列化
    
    Attributes:
        id: 超级管理员 ID
        username: 用户名
        email: 用户邮箱（可选）
        full_name: 用户全名（可选）
        is_active: 是否激活
        last_login: 最后登录时间（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="超级管理员 ID")
    last_login: Optional[datetime] = Field(None, description="最后登录时间（可选）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class SuperAdminListResponse(BaseModel):
    """
    超级管理员列表响应 Schema
    
    用于分页列表响应
    
    Attributes:
        items: 超级管理员列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    
    items: list[SuperAdminResponse] = Field(..., description="超级管理员列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class SuperAdminLoginRequest(BaseModel):
    """
    超级管理员登录请求 Schema
    
    用于超级管理员登录时的数据验证
    
    Attributes:
        username: 用户名（必填）
        password: 密码（必填）
    """
    
    username: str = Field(..., min_length=1, max_length=50, description="用户名")
    password: str = Field(..., min_length=1, max_length=100, description="密码")


class SuperAdminLoginResponse(BaseModel):
    """
    超级管理员登录响应 Schema
    
    用于超级管理员登录成功后的响应数据
    
    Attributes:
        token: JWT 访问令牌（不包含 tenant_id）
        token_type: Token 类型（固定为 "bearer"）
        user: 超级管理员信息
    """
    
    token: str = Field(..., description="JWT 访问令牌（不包含 tenant_id）")
    token_type: str = Field(default="bearer", description="Token 类型")
    user: SuperAdminResponse = Field(..., description="超级管理员信息")

