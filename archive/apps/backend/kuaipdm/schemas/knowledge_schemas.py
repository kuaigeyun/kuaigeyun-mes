"""
知识管理 Schema 模块

定义知识管理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class KnowledgeBase(BaseModel):
    """知识管理基础 Schema"""
    
    knowledge_no: str = Field(..., max_length=50, description="知识编号")
    knowledge_type: str = Field(..., max_length=50, description="知识类型")
    title: str = Field(..., max_length=200, description="知识标题")
    content: str = Field(..., description="知识内容")
    category: Optional[str] = Field(None, max_length=100, description="知识分类")
    tags: Optional[List[str]] = Field(None, description="知识标签")
    is_public: bool = Field(False, description="是否公开")


class KnowledgeCreate(KnowledgeBase):
    """创建知识 Schema"""
    pass


class KnowledgeUpdate(BaseModel):
    """更新知识 Schema"""
    
    knowledge_type: Optional[str] = Field(None, max_length=50, description="知识类型")
    title: Optional[str] = Field(None, max_length=200, description="知识标题")
    content: Optional[str] = Field(None, description="知识内容")
    category: Optional[str] = Field(None, max_length=100, description="知识分类")
    tags: Optional[List[str]] = Field(None, description="知识标签")
    is_public: Optional[bool] = Field(None, description="是否公开")


class KnowledgeResponse(KnowledgeBase):
    """知识响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    author_id: int
    view_count: int
    like_count: int
    rating: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
