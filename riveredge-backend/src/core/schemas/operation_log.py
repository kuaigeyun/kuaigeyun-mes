"""
操作日志 Schema 模块

定义操作日志相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class OperationLogResponse(BaseModel):
    """操作日志响应 Schema"""
    uuid: UUID = Field(..., description="操作日志UUID")
    tenant_id: int = Field(..., description="组织ID")
    user_id: int = Field(..., description="操作用户ID")
    # 用户信息（可选，用于前端友好显示）
    username: Optional[str] = Field(None, description="操作用户名")
    user_full_name: Optional[str] = Field(None, description="操作用户全名")
    operation_type: str = Field(..., description="操作类型")
    operation_module: Optional[str] = Field(None, description="操作模块")
    operation_object_type: Optional[str] = Field(None, description="操作对象类型")
    operation_object_id: Optional[int] = Field(None, description="操作对象ID")
    operation_object_uuid: Optional[str] = Field(None, description="操作对象UUID")
    operation_content: Optional[str] = Field(None, description="操作内容")
    ip_address: Optional[str] = Field(None, description="操作IP")
    user_agent: Optional[str] = Field(None, description="用户代理")
    request_method: Optional[str] = Field(None, description="请求方法")
    request_path: Optional[str] = Field(None, description="请求路径")
    created_at: datetime = Field(..., description="创建时间")
    
    model_config = ConfigDict(from_attributes=True)


class OperationLogListResponse(BaseModel):
    """操作日志列表响应 Schema"""
    items: list[OperationLogResponse] = Field(..., description="操作日志列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class OperationLogStatsResponse(BaseModel):
    """操作日志统计响应 Schema"""
    total: int = Field(..., description="总操作数")
    by_type: dict = Field(default_factory=dict, description="按操作类型统计")
    by_module: dict = Field(default_factory=dict, description="按操作模块统计")

