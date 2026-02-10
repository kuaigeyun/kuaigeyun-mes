"""
消息模板 Schema 模块

定义消息模板相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class MessageTemplateBase(BaseModel):
    """消息模板基础 Schema"""
    name: str = Field(..., max_length=100, description="模板名称")
    code: str = Field(..., max_length=50, description="模板代码")
    type: str = Field(..., max_length=20, description="消息类型")
    description: Optional[str] = Field(None, description="模板描述")
    subject: Optional[str] = Field(None, max_length=200, description="主题（邮件、推送通知）")
    content: str = Field(..., description="模板内容（支持变量）")
    variables: Optional[Dict[str, Any]] = Field(None, description="模板变量定义（JSON格式）")
    is_active: bool = Field(True, description="是否启用")
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        """验证消息类型"""
        allowed_types = ['email', 'sms', 'internal', 'push']
        if v not in allowed_types:
            raise ValueError(f'消息类型必须是 {allowed_types} 之一')
        return v


class MessageTemplateCreate(MessageTemplateBase):
    """创建消息模板 Schema"""
    pass


class MessageTemplateUpdate(BaseModel):
    """更新消息模板 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="模板名称")
    code: Optional[str] = Field(None, max_length=50, description="模板代码")
    type: Optional[str] = Field(None, max_length=20, description="消息类型")
    description: Optional[str] = Field(None, description="模板描述")
    subject: Optional[str] = Field(None, max_length=200, description="主题")
    content: Optional[str] = Field(None, description="模板内容")
    variables: Optional[Dict[str, Any]] = Field(None, description="模板变量定义")
    is_active: Optional[bool] = Field(None, description="是否启用")


class MessageTemplateResponse(MessageTemplateBase):
    """消息模板响应 Schema"""
    uuid: UUID = Field(..., description="消息模板UUID")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class SendMessageRequest(BaseModel):
    """发送消息请求 Schema"""
    template_uuid: Optional[UUID] = Field(None, description="模板UUID（可选）")
    template_code: Optional[str] = Field(None, max_length=50, description="模板代码（可选）")
    config_uuid: Optional[UUID] = Field(None, description="配置UUID（可选，使用默认配置）")
    type: str = Field(..., max_length=20, description="消息类型")
    recipient: str = Field(..., max_length=200, description="接收者")
    subject: Optional[str] = Field(None, max_length=200, description="主题")
    content: Optional[str] = Field(None, description="消息内容（如果使用了模板，则可选）")
    variables: Optional[Dict[str, Any]] = Field(None, description="模板变量值（JSON格式）")


class SendMessageResponse(BaseModel):
    """发送消息响应 Schema"""
    success: bool = Field(..., description="是否成功")
    message_log_uuid: Optional[UUID] = Field(None, description="消息记录UUID")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    error: Optional[str] = Field(None, description="错误信息")

