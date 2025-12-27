"""
生产追溯 Schema 模块

定义生产追溯相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class TraceabilityBase(BaseModel):
    """生产追溯基础 Schema"""
    
    trace_no: str = Field(..., max_length=50, description="追溯编号")
    trace_type: str = Field(..., max_length=50, description="追溯类型")
    batch_no: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_no: Optional[str] = Field(None, max_length=50, description="序列号")
    product_id: int = Field(..., description="产品ID")
    product_name: str = Field(..., max_length=200, description="产品名称")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_uuid: Optional[str] = Field(None, max_length=36, description="工单UUID")
    operation_id: Optional[int] = Field(None, description="工序ID")
    operation_name: Optional[str] = Field(None, max_length=200, description="工序名称")
    material_id: Optional[int] = Field(None, description="原材料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="原材料名称")
    material_batch_no: Optional[str] = Field(None, max_length=50, description="原材料批次号")
    quantity: Decimal = Field(0, description="数量")
    trace_data: Optional[Dict[str, Any]] = Field(None, description="追溯数据（JSON格式）")


class TraceabilityCreate(TraceabilityBase):
    """创建生产追溯 Schema"""
    pass


class TraceabilityResponse(TraceabilityBase):
    """生产追溯响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
