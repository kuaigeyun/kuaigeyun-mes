"""
个人资料 Schema 模块

定义个人资料相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from uuid import UUID


class UserProfileBase(BaseModel):
    """个人资料基础 Schema"""
    avatar: Optional[str] = Field(None, description="头像文件UUID")
    bio: Optional[str] = Field(None, description="个人简介")
    contact_info: Optional[Dict[str, Any]] = Field(None, description="联系方式（JSON格式）")
    gender: Optional[str] = Field(None, description="性别（可选，如：male, female, other）")
    email: Optional[str] = Field(None, description="邮箱")
    full_name: Optional[str] = Field(None, description="用户全名")
    phone: Optional[str] = Field(None, description="手机号")
    username: Optional[str] = Field(None, min_length=1, max_length=50, description="用户名（同一租户内唯一）")


class UserProfileUpdate(UserProfileBase):
    """更新个人资料 Schema"""
    pass


class UserProfileResponse(UserProfileBase):
    """个人资料响应 Schema"""
    uuid: UUID = Field(..., description="用户UUID")
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(None, description="邮箱")
    full_name: Optional[str] = Field(None, description="用户全名")
    phone: Optional[str] = Field(None, description="手机号")
    # gender 字段已在 UserProfileBase 中定义，这里不需要重复定义
    
    model_config = ConfigDict(from_attributes=True)
