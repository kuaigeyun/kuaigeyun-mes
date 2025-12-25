"""
工程变更 Schema 模块

定义工程变更相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class EngineeringChangeBase(BaseModel):
    """工程变更基础 Schema"""
    
    change_no: str = Field(..., max_length=50, description="变更编号")
    change_type: str = Field(..., max_length=50, description="变更类型")
    change_reason: str = Field(..., description="变更原因")
    change_content: str = Field(..., description="变更内容描述")
    change_impact: Optional[str] = Field(None, description="变更影响分析")
    priority: str = Field("普通", max_length=20, description="优先级")
    product_id: Optional[int] = Field(None, description="关联产品ID")


class EngineeringChangeCreate(EngineeringChangeBase):
    """创建工程变更 Schema"""
    pass


class EngineeringChangeUpdate(BaseModel):
    """更新工程变更 Schema"""
    
    change_type: Optional[str] = Field(None, max_length=50, description="变更类型")
    change_reason: Optional[str] = Field(None, description="变更原因")
    change_content: Optional[str] = Field(None, description="变更内容描述")
    change_impact: Optional[str] = Field(None, description="变更影响分析")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")
    status: Optional[str] = Field(None, max_length=50, description="变更状态")
    product_id: Optional[int] = Field(None, description="关联产品ID")
    executor_id: Optional[int] = Field(None, description="执行人ID")
    execution_start_date: Optional[datetime] = Field(None, description="执行开始日期")
    execution_end_date: Optional[datetime] = Field(None, description="执行结束日期")
    execution_result: Optional[str] = Field(None, description="执行结果")


class EngineeringChangeResponse(EngineeringChangeBase):
    """工程变更响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    approval_instance_id: Optional[int] = None
    approval_status: Optional[str] = None
    executor_id: Optional[int] = None
    execution_start_date: Optional[datetime] = None
    execution_end_date: Optional[datetime] = None
    execution_result: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
