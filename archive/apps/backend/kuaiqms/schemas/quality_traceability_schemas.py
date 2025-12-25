"""
质量追溯 Schema 模块

定义质量追溯相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class QualityTraceabilityBase(BaseModel):
    """质量追溯基础 Schema"""
    
    trace_no: str = Field(..., max_length=50, description="追溯编号")
    trace_type: str = Field(..., max_length=50, description="追溯类型")
    batch_no: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_no: Optional[str] = Field(None, max_length=50, description="序列号")
    material_id: int = Field(..., description="物料ID")
    material_name: str = Field(..., max_length=200, description="物料名称")
    trace_data: Optional[Any] = Field(None, description="追溯数据（JSON）")
    remark: Optional[str] = Field(None, description="备注")


class QualityTraceabilityCreate(QualityTraceabilityBase):
    """创建质量追溯 Schema"""
    pass


class QualityTraceabilityResponse(QualityTraceabilityBase):
    """质量追溯响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
