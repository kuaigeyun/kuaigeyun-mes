"""
工单 Schema 模块

定义工单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class WorkOrderBase(BaseModel):
    """工单基础 Schema"""
    
    work_order_no: str = Field(..., max_length=50, description="工单编号")
    order_id: Optional[int] = Field(None, description="生产订单ID")
    order_uuid: Optional[str] = Field(None, max_length=36, description="生产订单UUID")
    product_id: int = Field(..., description="产品ID")
    product_name: str = Field(..., max_length=200, description="产品名称")
    quantity: Decimal = Field(..., description="计划数量")
    route_id: Optional[int] = Field(None, description="工艺路线ID")
    route_name: Optional[str] = Field(None, max_length=200, description="工艺路线名称")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    operator_id: Optional[int] = Field(None, description="操作员ID")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作员姓名")
    remark: Optional[str] = Field(None, description="备注")


class WorkOrderCreate(WorkOrderBase):
    """创建工单 Schema"""
    pass


class WorkOrderUpdate(BaseModel):
    """更新工单 Schema"""
    
    product_id: Optional[int] = Field(None, description="产品ID")
    product_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    quantity: Optional[Decimal] = Field(None, description="计划数量")
    status: Optional[str] = Field(None, max_length=50, description="工单状态")
    current_operation: Optional[str] = Field(None, max_length=100, description="当前工序")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    operator_id: Optional[int] = Field(None, description="操作员ID")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作员姓名")
    remark: Optional[str] = Field(None, description="备注")


class WorkOrderResponse(WorkOrderBase):
    """工单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    completed_quantity: Decimal
    defective_quantity: Decimal
    current_operation: Optional[str] = None
    status: str
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
