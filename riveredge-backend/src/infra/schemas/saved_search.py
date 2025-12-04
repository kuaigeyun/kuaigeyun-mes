"""
保存搜索条件 Schema 模块

定义保存搜索条件相关的 Pydantic Schema，用于 API 请求和响应的数据验证
"""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field, ConfigDict


class SavedSearchBase(BaseModel):
    """
    保存搜索条件基础 Schema
    
    包含保存搜索条件的通用字段定义
    
    Attributes:
        page_path: 页面路径
        name: 搜索条件名称
        is_shared: 是否共享给其他用户
        is_pinned: 是否置顶
        search_params: 搜索参数（JSON 存储）
    """
    
    page_path: str = Field(..., max_length=255, description="页面路径")
    name: str = Field(..., min_length=1, max_length=100, description="搜索条件名称")
    is_shared: bool = Field(default=False, description="是否共享给其他用户")
    is_pinned: bool = Field(default=False, description="是否置顶")
    search_params: Dict[str, Any] = Field(default_factory=dict, description="搜索参数（JSON 存储）")


class SavedSearchCreate(SavedSearchBase):
    """
    保存搜索条件创建 Schema
    
    用于创建新保存搜索条件时的数据验证
    """
    pass


class SavedSearchUpdate(BaseModel):
    """
    保存搜索条件更新 Schema
    
    用于更新保存搜索条件信息时的数据验证。
    所有字段都是可选的，只更新提供的字段。
    """
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="搜索条件名称")
    is_shared: Optional[bool] = Field(None, description="是否共享给其他用户")
    is_pinned: Optional[bool] = Field(None, description="是否置顶")
    search_params: Optional[Dict[str, Any]] = Field(None, description="搜索参数（JSON 存储）")


class SavedSearchResponse(SavedSearchBase):
    """
    保存搜索条件响应 Schema
    
    用于 API 响应时的数据序列化
    
    Attributes:
        id: 搜索条件 ID
        uuid: 业务ID（UUID，对外暴露）
        tenant_id: 组织 ID
        user_id: 用户 ID
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="搜索条件 ID")
    uuid: str = Field(..., description="业务ID（UUID，对外暴露）")
    tenant_id: Optional[int] = Field(None, description="组织 ID")
    user_id: int = Field(..., description="用户 ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class SavedSearchListResponse(BaseModel):
    """
    保存搜索条件列表响应 Schema
    
    用于分页列表查询的响应
    
    Attributes:
        items: 搜索条件列表
        total: 总数量
    """
    
    items: List[SavedSearchResponse] = Field(default_factory=list, description="搜索条件列表")
    total: int = Field(default=0, description="总数量")

