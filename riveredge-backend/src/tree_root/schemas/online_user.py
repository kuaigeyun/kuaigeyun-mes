"""
在线用户 Schema 模块

定义在线用户相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime


class OnlineUserResponse(BaseModel):
    """在线用户响应 Schema"""
    user_id: int = Field(..., description="用户ID")
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(None, description="邮箱")
    full_name: Optional[str] = Field(None, description="用户全名")
    tenant_id: int = Field(..., description="组织ID")
    login_ip: Optional[str] = Field(None, description="登录IP")
    login_time: Optional[datetime] = Field(None, description="登录时间")
    last_activity_time: Optional[datetime] = Field(None, description="最后活动时间")
    session_id: Optional[str] = Field(None, description="会话ID（JWT Token 的 jti，如果存在）")
    
    model_config = ConfigDict(from_attributes=True)


class OnlineUserListResponse(BaseModel):
    """在线用户列表响应 Schema"""
    items: list[OnlineUserResponse] = Field(..., description="在线用户列表")
    total: int = Field(..., description="总数量")


class OnlineUserStatisticsResponse(BaseModel):
    """在线用户统计响应 Schema"""
    total: int = Field(..., description="总在线用户数")
    active: int = Field(..., description="活跃用户数（最近5分钟有活动）")
    by_tenant: Dict[str, int] = Field(default_factory=dict, description="按组织统计在线用户数")

