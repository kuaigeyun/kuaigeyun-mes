"""
LRP批次 Schema 模块

定义LRP批次相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class LRPBatchBase(BaseModel):
    """LRP批次基础 Schema"""
    
    batch_no: str = Field(..., max_length=50, description="批次编号")
    batch_name: str = Field(..., max_length=200, description="批次名称")
    order_ids: Optional[List[int]] = Field(None, description="关联订单ID列表")
    planned_date: Optional[datetime] = Field(None, description="计划日期")
    delivery_date: Optional[datetime] = Field(None, description="交期要求")
    batch_params: Optional[Dict[str, Any]] = Field(None, description="批次参数")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class LRPBatchCreate(LRPBatchBase):
    """创建LRP批次 Schema"""
    pass


class LRPBatchUpdate(BaseModel):
    """更新LRP批次 Schema"""
    
    batch_name: Optional[str] = Field(None, max_length=200, description="批次名称")
    order_ids: Optional[List[int]] = Field(None, description="关联订单ID列表")
    status: Optional[str] = Field(None, max_length=50, description="批次状态")
    planned_date: Optional[datetime] = Field(None, description="计划日期")
    delivery_date: Optional[datetime] = Field(None, description="交期要求")
    batch_params: Optional[Dict[str, Any]] = Field(None, description="批次参数")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class LRPBatchResponse(LRPBatchBase):
    """LRP批次响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
