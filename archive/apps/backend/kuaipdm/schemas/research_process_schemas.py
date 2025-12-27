"""
研发流程 Schema 模块

定义研发流程相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class ResearchProcessBase(BaseModel):
    """研发流程基础 Schema"""
    
    process_no: str = Field(..., max_length=50, description="流程编号")
    process_name: str = Field(..., max_length=200, description="流程名称")
    process_type: str = Field(..., max_length=50, description="流程类型")
    process_template: Optional[Dict[str, Any]] = Field(None, description="流程模板")
    product_id: Optional[int] = Field(None, description="关联产品ID")
    project_id: Optional[int] = Field(None, description="关联项目ID")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class ResearchProcessCreate(ResearchProcessBase):
    """创建研发流程 Schema"""
    pass


class ResearchProcessUpdate(BaseModel):
    """更新研发流程 Schema"""
    
    process_name: Optional[str] = Field(None, max_length=200, description="流程名称")
    process_type: Optional[str] = Field(None, max_length=50, description="流程类型")
    process_template: Optional[Dict[str, Any]] = Field(None, description="流程模板")
    current_stage: Optional[str] = Field(None, max_length=100, description="当前阶段")
    status: Optional[str] = Field(None, max_length=50, description="流程状态")
    product_id: Optional[int] = Field(None, description="关联产品ID")
    project_id: Optional[int] = Field(None, description="关联项目ID")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class ResearchProcessResponse(ResearchProcessBase):
    """研发流程响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    current_stage: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
