"""
不合格品处理 Schema 模块

定义不合格品处理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class NonconformingHandlingBase(BaseModel):
    """不合格品处理基础 Schema"""
    
    handling_no: str = Field(..., max_length=50, description="处理单编号")
    nonconforming_product_id: Optional[int] = Field(None, description="不合格品记录ID")
    nonconforming_product_uuid: Optional[str] = Field(None, max_length=36, description="不合格品记录UUID")
    handling_type: str = Field(..., max_length=50, description="处理类型")
    handling_plan: str = Field(..., description="处理方案")
    handling_executor_id: Optional[int] = Field(None, description="处理执行人ID")
    handling_executor_name: Optional[str] = Field(None, max_length=100, description="处理执行人姓名")
    handling_date: Optional[datetime] = Field(None, description="处理日期")
    handling_result: Optional[str] = Field(None, max_length=50, description="处理结果")
    handling_quantity: Optional[Decimal] = Field(None, description="处理数量")
    remark: Optional[str] = Field(None, description="备注")


class NonconformingHandlingCreate(NonconformingHandlingBase):
    """创建不合格品处理 Schema"""
    pass


class NonconformingHandlingUpdate(BaseModel):
    """更新不合格品处理 Schema"""
    
    handling_type: Optional[str] = Field(None, max_length=50, description="处理类型")
    handling_plan: Optional[str] = Field(None, description="处理方案")
    handling_executor_id: Optional[int] = Field(None, description="处理执行人ID")
    handling_executor_name: Optional[str] = Field(None, max_length=100, description="处理执行人姓名")
    handling_date: Optional[datetime] = Field(None, description="处理日期")
    handling_result: Optional[str] = Field(None, max_length=50, description="处理结果")
    handling_quantity: Optional[Decimal] = Field(None, description="处理数量")
    status: Optional[str] = Field(None, max_length=50, description="处理状态")
    remark: Optional[str] = Field(None, description="备注")


class NonconformingHandlingResponse(NonconformingHandlingBase):
    """不合格品处理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
