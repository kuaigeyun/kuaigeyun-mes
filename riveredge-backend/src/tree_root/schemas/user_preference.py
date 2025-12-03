"""
用户偏好 Schema 模块

定义用户偏好相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class UserPreferenceBase(BaseModel):
    """用户偏好基础 Schema"""
    preferences: Dict[str, Any] = Field(default_factory=dict, description="偏好设置（JSON格式）")


class UserPreferenceUpdate(BaseModel):
    """更新用户偏好 Schema"""
    preferences: Optional[Dict[str, Any]] = Field(None, description="偏好设置（JSON格式）")


class UserPreferenceResponse(UserPreferenceBase):
    """用户偏好响应 Schema"""
    uuid: UUID = Field(..., description="用户偏好UUID")
    tenant_id: int = Field(..., description="组织ID")
    user_id: int = Field(..., description="关联用户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

