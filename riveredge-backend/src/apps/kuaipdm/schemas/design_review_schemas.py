"""
设计评审 Schema 模块

定义设计评审相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class DesignReviewBase(BaseModel):
    """设计评审基础 Schema"""
    
    review_no: str = Field(..., max_length=50, description="评审编号")
    review_type: str = Field(..., max_length=50, description="评审类型")
    review_stage: Optional[str] = Field(None, max_length=50, description="评审阶段")
    product_id: Optional[int] = Field(None, description="关联产品ID")
    review_date: Optional[datetime] = Field(None, description="评审日期")
    review_content: Optional[str] = Field(None, description="评审内容")
    reviewers: Optional[List[Dict[str, Any]]] = Field(None, description="评审人员列表")


class DesignReviewCreate(DesignReviewBase):
    """创建设计评审 Schema"""
    pass


class DesignReviewUpdate(BaseModel):
    """更新设计评审 Schema"""
    
    review_type: Optional[str] = Field(None, max_length=50, description="评审类型")
    review_stage: Optional[str] = Field(None, max_length=50, description="评审阶段")
    product_id: Optional[int] = Field(None, description="关联产品ID")
    review_date: Optional[datetime] = Field(None, description="评审日期")
    status: Optional[str] = Field(None, max_length=50, description="评审状态")
    conclusion: Optional[str] = Field(None, max_length=50, description="评审结论")
    review_content: Optional[str] = Field(None, description="评审内容")
    review_result: Optional[str] = Field(None, description="评审结果")
    reviewers: Optional[List[Dict[str, Any]]] = Field(None, description="评审人员列表")


class DesignReviewResponse(DesignReviewBase):
    """设计评审响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    conclusion: Optional[str] = None
    review_result: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
