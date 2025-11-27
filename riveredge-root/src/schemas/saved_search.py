"""
保存搜索条件 Schema 模块

定义保存搜索条件的 Pydantic Schema，用于 API 请求和响应
"""

from typing import Optional, Dict, Any
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict, field_serializer


class SavedSearchCreate(BaseModel):
    """
    创建保存搜索条件请求 Schema
    """
    page_path: str = Field(..., description="页面路径（用于区分不同页面的搜索条件）", max_length=255)
    name: str = Field(..., description="搜索条件名称", max_length=100)
    is_shared: bool = Field(default=False, description="是否共享（True：共享，False：个人）")
    search_params: Dict[str, Any] = Field(..., description="搜索参数（JSON 格式）")


class SavedSearchUpdate(BaseModel):
    """
    更新保存搜索条件请求 Schema
    """
    name: Optional[str] = Field(None, description="搜索条件名称", max_length=100)
    is_shared: Optional[bool] = Field(None, description="是否共享（True：共享，False：个人）")
    search_params: Optional[Dict[str, Any]] = Field(None, description="搜索参数（JSON 格式）")


class SavedSearchResponse(BaseModel):
    """
    保存搜索条件响应 Schema
    """
    id: int = Field(..., description="搜索条件 ID")
    tenant_id: Optional[int] = Field(None, description="组织 ID")
    user_id: int = Field(..., description="创建者用户 ID")
    page_path: str = Field(..., description="页面路径")
    name: str = Field(..., description="搜索条件名称")
    is_shared: bool = Field(..., description="是否共享")
    search_params: Dict[str, Any] = Field(..., description="搜索参数")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    @field_serializer('created_at', 'updated_at', when_used='json')
    def serialize_datetime(self, dt: datetime, _info) -> str:
        """
        序列化 datetime 字段，确保时区处理正确
        
        如果 datetime 是时区感知的，移除时区信息
        如果是时区无关的，直接转换为字符串
        """
        if dt is None:
            return None
        # 如果是时区感知的 datetime，移除时区信息
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt.isoformat()
    
    model_config = ConfigDict(from_attributes=True)


class SavedSearchListResponse(BaseModel):
    """
    保存搜索条件列表响应 Schema
    """
    total: int = Field(..., description="总数")
    items: list[SavedSearchResponse] = Field(..., description="搜索条件列表")

