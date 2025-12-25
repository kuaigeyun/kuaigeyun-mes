"""
生产报工 Schema 模块

定义生产报工相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProductionReportBase(BaseModel):
    """生产报工基础 Schema"""
    
    report_no: str = Field(..., max_length=50, description="报工单编号")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_uuid: Optional[str] = Field(None, max_length=36, description="工单UUID")
    operation_id: Optional[int] = Field(None, description="工序ID")
    operation_name: Optional[str] = Field(None, max_length=200, description="工序名称")
    report_date: datetime = Field(..., description="报工日期")
    quantity: Decimal = Field(..., description="报工数量")
    qualified_quantity: Decimal = Field(0, description="合格数量")
    defective_quantity: Decimal = Field(0, description="不良品数量")
    defective_reason: Optional[str] = Field(None, description="不良品原因")
    work_hours: Decimal = Field(0, description="工时（小时）")
    operator_id: Optional[int] = Field(None, description="操作员ID")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作员姓名")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    batch_no: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_no: Optional[str] = Field(None, max_length=50, description="序列号")
    remark: Optional[str] = Field(None, description="备注")


class ProductionReportCreate(ProductionReportBase):
    """创建生产报工 Schema"""
    pass


class ProductionReportUpdate(BaseModel):
    """更新生产报工 Schema"""
    
    operation_id: Optional[int] = Field(None, description="工序ID")
    operation_name: Optional[str] = Field(None, max_length=200, description="工序名称")
    report_date: Optional[datetime] = Field(None, description="报工日期")
    quantity: Optional[Decimal] = Field(None, description="报工数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    defective_quantity: Optional[Decimal] = Field(None, description="不良品数量")
    defective_reason: Optional[str] = Field(None, description="不良品原因")
    work_hours: Optional[Decimal] = Field(None, description="工时（小时）")
    status: Optional[str] = Field(None, max_length=50, description="报工状态")
    batch_no: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_no: Optional[str] = Field(None, max_length=50, description="序列号")
    remark: Optional[str] = Field(None, description="备注")


class ProductionReportResponse(ProductionReportBase):
    """生产报工响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
