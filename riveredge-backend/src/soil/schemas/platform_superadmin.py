"""
平台超级管理员 Schema 模块

定义平台超级管理员相关的 Pydantic Schema，用于 API 请求和响应的数据验证
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr, ConfigDict


class PlatformSuperAdminBase(BaseModel):
    """
    平台超级管理员基础 Schema
    
    包含平台超级管理员的通用字段定义
    
    Attributes:
        username: 用户名（平台唯一）
        email: 用户邮箱（可选）
        full_name: 用户全名（可选）
        is_active: 是否激活
    """
    
    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符，平台唯一）")
    email: Optional[EmailStr] = Field(None, description="用户邮箱（可选）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    is_active: bool = Field(default=True, description="是否激活")


class PlatformSuperAdminCreate(BaseModel):
    """
    平台超级管理员创建 Schema
    
    用于创建平台超级管理员时的数据验证。
    注意：平台超级管理员是平台唯一的，只能创建一个。
    
    Attributes:
        username: 用户名（必填，3-50 字符，平台唯一）
        email: 用户邮箱（可选）
        password: 密码（必填，最少 8 字符）
        full_name: 用户全名（可选）
        is_active: 是否激活（可选，默认 True）
    """
    
    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符，平台唯一）")
    email: Optional[EmailStr] = Field(None, description="用户邮箱（可选）")
    password: str = Field(..., min_length=8, max_length=100, description="密码（最少 8 字符）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    is_active: bool = Field(default=True, description="是否激活")


class PlatformSuperAdminUpdate(BaseModel):
    """
    平台超级管理员更新 Schema
    
    用于更新平台超级管理员信息时的数据验证。
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


class PlatformSuperAdminResponse(PlatformSuperAdminBase):
    """
    平台超级管理员响应 Schema
    
    用于 API 响应时的数据序列化
    
    Attributes:
        id: 平台超级管理员 ID
        username: 用户名
        email: 用户邮箱（可选）
        full_name: 用户全名（可选）
        is_active: 是否激活
        last_login: 最后登录时间（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="平台超级管理员 ID")
    last_login: Optional[datetime] = Field(None, description="最后登录时间（可选）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class PlatformSuperAdminLoginRequest(BaseModel):
    """
    平台超级管理员登录请求 Schema
    
    用于平台超级管理员登录时的数据验证
    
    Attributes:
        username: 用户名（必填）
        password: 密码（必填）
    """
    
    username: str = Field(..., min_length=1, max_length=50, description="用户名")
    password: str = Field(..., min_length=1, max_length=100, description="密码")


class PlatformSuperAdminLoginResponse(BaseModel):
    """
    平台超级管理员登录响应 Schema
    
    用于平台超级管理员登录成功后的响应数据
    
    Attributes:
        access_token: JWT 访问令牌
        token_type: Token 类型（固定为 "bearer"）
        expires_in: Token 过期时间（秒）
        user: 平台超级管理员信息
    """
    
    access_token: str = Field(..., description="JWT 访问令牌")
    token_type: str = Field(default="bearer", description="Token 类型")
    expires_in: int = Field(..., description="Token 过期时间（秒）")
    user: PlatformSuperAdminResponse = Field(..., description="平台超级管理员信息")

