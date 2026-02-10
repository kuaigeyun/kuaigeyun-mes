"""
消息配置 Schema 模块

定义消息配置相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class MessageConfigBase(BaseModel):
    """消息配置基础 Schema"""
    name: str = Field(..., max_length=100, description="配置名称")
    code: str = Field(..., max_length=50, description="配置代码")
    type: str = Field(..., max_length=20, description="消息类型")
    description: Optional[str] = Field(None, description="配置描述")
    config: Dict[str, Any] = Field(..., description="配置信息")
    is_active: bool = Field(True, description="是否启用")
    is_default: bool = Field(False, description="是否默认配置")
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        """验证消息类型"""
        allowed_types = ['email', 'sms', 'internal', 'push']
        if v not in allowed_types:
            raise ValueError(f'消息类型必须是 {allowed_types} 之一')
        return v


class MessageConfigCreate(MessageConfigBase):
    """创建消息配置 Schema"""
    pass


class MessageConfigUpdate(BaseModel):
    """更新消息配置 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="配置名称")
    code: Optional[str] = Field(None, max_length=50, description="配置代码")
    type: Optional[str] = Field(None, max_length=20, description="消息类型")
    description: Optional[str] = Field(None, description="配置描述")
    config: Optional[Dict[str, Any]] = Field(None, description="配置信息")
    is_active: Optional[bool] = Field(None, description="是否启用")
    is_default: Optional[bool] = Field(None, description="是否默认配置")


class MessageConfigResponse(MessageConfigBase):
    """消息配置响应 Schema"""
    uuid: UUID = Field(..., description="消息配置UUID")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class MessageConfigTestRequest(BaseModel):
    """测试消息配置请求 Schema"""
    type: str = Field(..., max_length=20, description="消息类型")
    config: Dict[str, Any] = Field(..., description="配置信息")
    target: str = Field(..., description="测试目标（如：接收邮箱、接收手机号）")


class MessageConfigTestResponse(BaseModel):
    """测试消息配置响应 Schema"""
    success: bool = Field(..., description="是否测试成功")
    message: str = Field(..., description="测试结果说明")
    error_detail: Optional[str] = Field(None, description="错误详情（如果失败）")

