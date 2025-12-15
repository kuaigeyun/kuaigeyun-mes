"""
返修工单 Schema 模块

定义返修工单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ReworkOrderBase(BaseModel):
    """返修工单基础 Schema"""
    
    rework_order_no: str = Field(..., max_length=50, description="返修工单编号")
    original_work_order_id: Optional[int] = Field(None, description="原工单ID")
    original_work_order_uuid: Optional[str] = Field(None, max_length=36, description="原工单UUID")
    product_id: int = Field(..., description="产品ID")
    product_name: str = Field(..., max_length=200, description="产品名称")
    quantity: Decimal = Field(..., description="返修数量")
    rework_reason: str = Field(..., description="返修原因")
    rework_type: str = Field(..., max_length=50, description="返修类型")
    route_id: Optional[int] = Field(None, description="返修工艺路线ID")
    route_name: Optional[str] = Field(None, max_length=200, description="返修工艺路线名称")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    operator_id: Optional[int] = Field(None, description="操作员ID")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作员姓名")
    remark: Optional[str] = Field(None, description="备注")


class ReworkOrderCreate(ReworkOrderBase):
    """创建返修工单 Schema"""
    pass


class ReworkOrderUpdate(BaseModel):
    """更新返修工单 Schema"""
    
    product_id: Optional[int] = Field(None, description="产品ID")
    product_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    quantity: Optional[Decimal] = Field(None, description="返修数量")
    rework_reason: Optional[str] = Field(None, description="返修原因")
    rework_type: Optional[str] = Field(None, max_length=50, description="返修类型")
    status: Optional[str] = Field(None, max_length=50, description="返修状态")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    operator_id: Optional[int] = Field(None, description="操作员ID")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作员姓名")
    cost: Optional[Decimal] = Field(None, description="返修成本")
    remark: Optional[str] = Field(None, description="备注")


class ReworkOrderResponse(ReworkOrderBase):
    """返修工单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    cost: Decimal
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
