"""
用户消息 Schema 模块

定义用户消息相关的 Pydantic Schema，用于数据验证和序列化。
复用 MessageLog 模型，但提供用户视角的 Schema。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class UserMessageResponse(BaseModel):
    """用户消息响应 Schema（复用 MessageLog）"""
    uuid: UUID = Field(..., description="消息UUID")
    tenant_id: int = Field(..., description="组织ID")
    template_uuid: Optional[str] = Field(None, description="关联模板UUID")
    config_uuid: Optional[str] = Field(None, description="关联配置UUID")
    type: str = Field(..., description="消息类型（也是渠道：email、sms、internal、push等）")
    recipient: str = Field(..., description="接收者（邮箱、手机号、用户ID等）")
    subject: Optional[str] = Field(None, description="消息主题")
    content: str = Field(..., description="消息内容")
    variables: Optional[Dict[str, Any]] = Field(None, description="模板变量值（JSON格式）")
    status: str = Field(..., description="消息状态（pending、sending、success、failed、read等）")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    error_message: Optional[str] = Field(None, description="错误信息")
    sent_at: Optional[datetime] = Field(None, description="发送时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class UserMessageListResponse(BaseModel):
    """用户消息列表响应 Schema"""
    items: list[UserMessageResponse] = Field(..., description="消息列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class UserMessageMarkReadRequest(BaseModel):
    """标记消息已读请求 Schema"""
    message_uuids: list[UUID] = Field(..., description="消息UUID列表")


class UserMessageStatsResponse(BaseModel):
    """用户消息统计响应 Schema"""
    total: int = Field(..., description="总消息数")
    unread: int = Field(..., description="未读消息数")
    read: int = Field(..., description="已读消息数")
    failed: int = Field(..., description="失败消息数")

