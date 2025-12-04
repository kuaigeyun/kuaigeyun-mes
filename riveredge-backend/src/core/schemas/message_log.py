"""
消息发送记录 Schema 模块

定义消息发送记录相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class MessageLogResponse(BaseModel):
    """消息发送记录响应 Schema"""
    uuid: UUID = Field(..., description="消息记录UUID")
    tenant_id: int = Field(..., description="组织ID")
    template_uuid: Optional[str] = Field(None, description="关联模板UUID")
    config_uuid: Optional[str] = Field(None, description="关联配置UUID")
    type: str = Field(..., description="消息类型")
    recipient: str = Field(..., description="接收者")
    subject: Optional[str] = Field(None, description="主题")
    content: str = Field(..., description="消息内容")
    variables: Optional[Dict[str, Any]] = Field(None, description="模板变量值")
    status: str = Field(..., description="发送状态")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    error_message: Optional[str] = Field(None, description="错误信息")
    sent_at: Optional[datetime] = Field(None, description="发送时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

