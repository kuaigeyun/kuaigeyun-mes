"""
邀请码 Schema 模块

定义邀请码相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class InvitationCodeBase(BaseModel):
    """
    邀请码基础 Schema
    
    包含邀请码的基本字段，用于创建和更新操作。
    """
    email: Optional[str] = Field(None, max_length=100, description="邀请邮箱（可选）")
    role_id: Optional[int] = Field(None, description="默认角色ID（可选）")
    max_uses: int = Field(default=1, ge=1, description="最大使用次数")
    expires_at: Optional[datetime] = Field(None, description="过期时间（可选）")
    is_active: bool = Field(default=True, description="是否启用")


class InvitationCodeCreate(InvitationCodeBase):
    """
    邀请码创建 Schema
    
    用于创建新邀请码的请求数据。
    """
    pass


class InvitationCodeUpdate(BaseModel):
    """
    邀请码更新 Schema
    
    用于更新邀请码的请求数据，所有字段可选。
    """
    email: Optional[str] = Field(None, max_length=100, description="邀请邮箱（可选）")
    role_id: Optional[int] = Field(None, description="默认角色ID（可选）")
    max_uses: Optional[int] = Field(None, ge=1, description="最大使用次数")
    expires_at: Optional[datetime] = Field(None, description="过期时间（可选）")
    is_active: Optional[bool] = Field(None, description="是否启用")


class InvitationCodeResponse(InvitationCodeBase):
    """
    邀请码响应 Schema
    
    用于返回邀请码信息。
    """
    uuid: str = Field(..., description="邀请码UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    code: str = Field(..., description="邀请码")
    used_count: int = Field(..., description="已使用次数")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class InvitationCodeVerifyRequest(BaseModel):
    """
    邀请码验证请求 Schema
    
    用于验证邀请码的请求数据。
    """
    code: str = Field(..., min_length=1, max_length=50, description="邀请码")


class InvitationCodeVerifyResponse(BaseModel):
    """
    邀请码验证响应 Schema
    
    用于返回邀请码验证结果。
    """
    valid: bool = Field(..., description="是否有效")
    message: str = Field(..., description="验证消息")
    invitation_code: Optional[InvitationCodeResponse] = Field(None, description="邀请码信息（如果有效）")

