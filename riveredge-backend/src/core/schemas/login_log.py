"""
登录日志 Schema 模块

定义登录日志相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class LoginLogBase(BaseModel):
    """登录日志基础 Schema"""
    tenant_id: Optional[int] = Field(None, description="组织ID（登录失败时可能为空）")
    user_id: Optional[int] = Field(None, description="登录用户ID（登录失败时可能为空）")
    username: Optional[str] = Field(None, description="登录账号")
    login_ip: str = Field(..., description="登录IP地址")
    login_location: Optional[str] = Field(None, description="登录地点")
    login_device: Optional[str] = Field(None, description="登录设备")
    login_browser: Optional[str] = Field(None, description="登录浏览器")
    login_status: str = Field(..., description="登录状态（success、failed）")
    failure_reason: Optional[str] = Field(None, description="失败原因")


class LoginLogCreate(LoginLogBase):
    """创建登录日志 Schema"""
    pass


class LoginLogResponse(LoginLogBase):
    """登录日志响应 Schema"""
    uuid: UUID = Field(..., description="登录日志UUID")
    tenant_id: Optional[int] = Field(None, description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    
    model_config = ConfigDict(from_attributes=True)


class LoginLogListResponse(BaseModel):
    """登录日志列表响应 Schema"""
    items: list[LoginLogResponse] = Field(..., description="登录日志列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class LoginLogStatsResponse(BaseModel):
    """登录日志统计响应 Schema"""
    total: int = Field(..., description="总登录数")
    success_count: int = Field(..., description="成功登录数")
    failed_count: int = Field(..., description="失败登录数")
    by_status: dict = Field(default_factory=dict, description="按登录状态统计")
    by_user: dict = Field(default_factory=dict, description="按用户统计（前10名）")

