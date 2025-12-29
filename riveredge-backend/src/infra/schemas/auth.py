"""
认证 Schema 模块

定义认证相关的 Pydantic Schema，用于登录、注册等认证操作
"""

from typing import Optional, List

from pydantic import BaseModel, Field, EmailStr, field_validator


class LoginRequest(BaseModel):
    """
    登录请求 Schema

    用于用户登录的请求数据。

    Attributes:
        username: 用户名或手机号（支持用户名或手机号登录）
        password: 密码
        tenant_id: 组织 ID（可选，如果提供则直接设置组织上下文）
    """

    username: str = Field(..., min_length=1, max_length=255, description="用户名或手机号（支持用户名或手机号登录）")
    password: str = Field(..., min_length=1, description="密码")
    tenant_id: Optional[int] = Field(None, description="组织 ID（可选，如果提供则直接设置组织上下文）")


class TenantInfo(BaseModel):
    """
    组织信息 Schema
    
    用于返回组织的基本信息。
    
    Attributes:
        id: 组织 ID（内部使用）
        uuid: 组织 UUID（对外暴露，业务标识）
        name: 组织名称
        domain: 组织域名
        status: 组织状态
    """
    
    id: int = Field(..., description="组织 ID（内部使用）")
    uuid: str = Field(..., description="组织 UUID（对外暴露，业务标识）")
    name: str = Field(..., description="组织名称")
    domain: str = Field(..., description="组织域名")
    status: str = Field(..., description="组织状态")


class LoginResponse(BaseModel):
    """
    登录响应 Schema
    
    用于返回登录成功的响应数据。
    
    Attributes:
        access_token: JWT 访问令牌
        token_type: 令牌类型（通常为 "bearer"）
        expires_in: 令牌过期时间（秒）
        user: 用户信息（可选）
        tenants: 用户可访问的组织列表（可选）
        default_tenant_id: 默认组织 ID（可选，超级用户使用）
        requires_tenant_selection: 是否需要选择组织（当用户有多个组织时）
    """
    
    access_token: str = Field(..., description="JWT 访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    expires_in: int = Field(..., description="令牌过期时间（秒）")
    user: Optional[dict] = Field(None, description="用户信息（可选）")
    tenants: Optional[List[TenantInfo]] = Field(None, description="用户可访问的组织列表（可选）")
    default_tenant_id: Optional[int] = Field(None, description="默认组织 ID（可选，超级用户使用）")
    requires_tenant_selection: bool = Field(default=False, description="是否需要选择组织（当用户有多个组织时）")


class UserRegisterRequest(BaseModel):
    """
    用户注册请求 Schema
    
    用于在已有组织中注册新用户的请求数据。
    
    Attributes:
        username: 用户名（必填，3-50 字符）
        email: 用户邮箱（可选，符合中国用户使用习惯）
        password: 密码（必填，最少 8 字符）
        full_name: 用户全名（可选）
        tenant_id: 组织 ID（必填，用于多组织隔离）
    """
    
    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符）")
    email: Optional[str] = Field(None, description="用户邮箱（可选，符合中国用户使用习惯）")
    password: str = Field(..., min_length=8, description="密码（至少8个字符）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    tenant_id: int = Field(..., description="组织 ID（用于多组织隔离）")


class PersonalRegisterRequest(BaseModel):
    """
    个人注册请求 Schema

    用于个人注册的请求数据。
    如果提供了 tenant_id，则在指定组织中创建用户；否则在默认组织中创建用户。

    Attributes:
        username: 用户名（必填，3-50 字符）
        phone: 手机号（必填，用于短信验证，符合中国用户使用习惯）
        email: 用户邮箱（可选，用于邮件通知）
        password: 密码（必填，最少 8 字符）
        full_name: 用户全名（可选）
        tenant_id: 组织 ID（可选，如果提供则在指定组织中创建用户，否则在默认组织中创建）
    """

    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符）")
    phone: str = Field(..., pattern=r'^1[3-9]\d{9}$', description="手机号（必填，11位中国大陆手机号）")
    email: Optional[str] = Field(None, description="用户邮箱（可选，用于邮件通知）")
    password: str = Field(..., min_length=8, description="密码（至少8个字符）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    tenant_id: Optional[int] = Field(None, description="组织 ID（可选，如果提供则在指定组织中创建用户，否则在默认组织中创建）")

    @field_validator('email', mode='before')
    @classmethod
    def validate_email(cls, v):
        """
        验证邮箱字段
        
        如果邮箱为空字符串，则转换为 None（非必填字段）
        
        Args:
            v: 邮箱值（可能是字符串、None 或其他类型）
            
        Returns:
            None 或有效的邮箱字符串
        """
        if v is None or (isinstance(v, str) and v.strip() == ''):
            return None
        return v


class SendVerificationCodeRequest(BaseModel):
    """
    发送验证码请求 Schema

    用于发送短信或邮箱验证码的请求数据。

    Attributes:
        phone: 手机号（可选，用于短信验证码）
        email: 邮箱地址（可选，用于邮箱验证码）
    """
    phone: Optional[str] = Field(None, pattern=r'^1[3-9]\d{9}$', description="手机号（可选，11位中国大陆手机号）")
    email: Optional[str] = Field(None, description="邮箱地址（可选）")


class SendVerificationCodeResponse(BaseModel):
    """
    发送验证码响应 Schema

    发送验证码的响应数据。

    Attributes:
        success: 是否发送成功
        message: 响应消息
    """
    success: bool = Field(..., description="是否发送成功")
    message: str = Field(..., description="响应消息")
    invite_code: Optional[str] = Field(None, max_length=100, description="邀请码（可选，如果同时提供组织ID和邀请码，则直接注册成功）")


class OrganizationRegisterRequest(BaseModel):
    """
    组织注册请求 Schema
    
    用于组织注册的请求数据（包含组织信息和管理员信息）。
    
    Attributes:
        tenant_name: 组织名称（必填）
        tenant_domain: 组织域名（可选，留空则自动生成8位随机域名）
        username: 管理员用户名（必填，3-50 字符）
        email: 管理员邮箱（可选，符合中国用户使用习惯）
        password: 管理员密码（必填，最少 8 字符）
        full_name: 管理员全名（可选）
    """
    
    tenant_name: str = Field(..., min_length=1, max_length=100, description="组织名称")
    tenant_domain: Optional[str] = Field(None, max_length=100, description="组织域名（可选，留空则自动生成8位随机域名，格式：riveredge.cn/xxxxx）")
    username: str = Field(..., min_length=3, max_length=50, description="管理员用户名（3-50 字符）")
    email: Optional[str] = Field(None, description="管理员邮箱（可选，符合中国用户使用习惯）")
    password: str = Field(..., min_length=8, max_length=100, description="管理员密码（最少 8 字符）")
    full_name: Optional[str] = Field(None, max_length=100, description="管理员全名（可选）")


class TenantJoinRequest(BaseModel):
    """
    申请加入组织请求 Schema
    
    用于申请加入已存在组织的请求数据。
    
    Attributes:
        tenant_id: 组织 ID（必填）
        username: 用户名（必填，3-50 字符）
        email: 邮箱（可选）
        password: 密码（必填，最少 8 字符）
        full_name: 全名（可选）
    """
    
    tenant_id: int = Field(..., description="组织 ID")
    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符）")
    email: Optional[str] = Field(None, description="邮箱（可选）")
    password: str = Field(..., min_length=8, description="密码（至少8个字符）")
    full_name: Optional[str] = Field(None, max_length=100, description="全名（可选）")


class RegisterResponse(BaseModel):
    """
    注册响应 Schema
    
    用于返回注册成功的响应数据。
    
    Attributes:
        id: 用户 ID
        username: 用户名
        email: 用户邮箱
        tenant_domain: 组织域名（可选，组织注册时返回）
        message: 注册成功消息
    """
    
    id: int = Field(..., description="用户 ID")
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(None, description="用户邮箱（可选）")
    tenant_domain: Optional[str] = Field(None, description="组织域名（可选，组织注册时返回，格式：riveredge.cn/xxxxx）")
    message: str = Field(default="注册成功", description="注册成功消息")


class TokenRefreshRequest(BaseModel):
    """
    Token 刷新请求 Schema
    
    用于刷新 JWT Token 的请求数据。
    
    Attributes:
        refresh_token: 刷新令牌（可选，如果未提供则使用当前访问令牌）
    """
    
    refresh_token: Optional[str] = Field(None, description="刷新令牌（可选）")


class TokenRefreshResponse(BaseModel):
    """
    Token 刷新响应 Schema
    
    用于返回刷新后的 Token 信息。
    
    Attributes:
        access_token: 新的 JWT 访问令牌
        token_type: 令牌类型（通常为 "bearer"）
        expires_in: 令牌过期时间（秒）
    """
    
    access_token: str = Field(..., description="新的 JWT 访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    expires_in: int = Field(..., description="令牌过期时间（秒）")


class CurrentUserResponse(BaseModel):
    """
    当前用户信息响应 Schema
    
    用于返回当前登录用户的信息。
    
    Attributes:
        id: 用户 ID（内部使用）
        uuid: 用户 UUID（对外暴露，业务标识）
        username: 用户名
        email: 用户邮箱
        full_name: 用户全名
        tenant_id: 组织 ID
        tenant_name: 组织名称（可选，如果用户有组织则返回）
        is_active: 是否激活
        is_infra_admin: 是否为平台管理
        is_tenant_admin: 是否为组织管理员
    """
    
    id: int = Field(..., description="用户 ID（内部使用）")
    uuid: str = Field(..., description="用户 UUID（对外暴露，业务标识）")
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(None, description="用户邮箱（可选）")
    full_name: Optional[str] = Field(None, description="用户全名")
    tenant_id: Optional[int] = Field(None, description="组织 ID（平台管理可能没有组织）")
    tenant_name: Optional[str] = Field(None, description="组织名称（可选，如果用户有组织则返回）")
    is_active: bool = Field(..., description="是否激活")
    is_infra_admin: bool = Field(..., description="是否为平台管理（系统级超级管理员）")
    is_tenant_admin: bool = Field(..., description="是否为组织管理员")


# 全局邮箱验证器
@field_validator('email', mode='before')
@classmethod
def validate_email(cls, v):
    """验证邮箱字段，允许空值"""
    if v is None or v == "":
        return None
    # 如果提供了值，则验证邮箱格式
    if '@' not in v:
        raise ValueError('邮箱格式不正确，必须包含@符号')
    return v
