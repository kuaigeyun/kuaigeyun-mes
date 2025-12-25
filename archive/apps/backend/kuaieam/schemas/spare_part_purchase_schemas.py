"""
备件采购 Schema 模块

定义备件采购相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SparePartPurchaseBase(BaseModel):
    """备件采购基础 Schema"""
    
    purchase_no: str = Field(..., max_length=100, description="采购单编号")
    demand_id: Optional[int] = Field(None, description="备件需求ID")
    demand_uuid: Optional[str] = Field(None, max_length=36, description="备件需求UUID")
    material_id: int = Field(..., description="物料ID")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    purchase_quantity: int = Field(..., description="采购数量")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    total_amount: Optional[Decimal] = Field(None, description="总金额")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    purchase_date: datetime = Field(..., description="采购日期")
    expected_delivery_date: Optional[datetime] = Field(None, description="预计到货日期")
    actual_delivery_date: Optional[datetime] = Field(None, description="实际到货日期")
    purchaser_id: Optional[int] = Field(None, description="采购人员ID")
    purchaser_name: Optional[str] = Field(None, max_length=100, description="采购人员姓名")
    remark: Optional[str] = Field(None, description="备注")


class SparePartPurchaseCreate(SparePartPurchaseBase):
    """创建备件采购 Schema"""
    pass


class SparePartPurchaseUpdate(BaseModel):
    """更新备件采购 Schema"""
    
    purchase_quantity: Optional[int] = Field(None, description="采购数量")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    total_amount: Optional[Decimal] = Field(None, description="总金额")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    expected_delivery_date: Optional[datetime] = Field(None, description="预计到货日期")
    actual_delivery_date: Optional[datetime] = Field(None, description="实际到货日期")
    status: Optional[str] = Field(None, max_length=50, description="采购状态")
    remark: Optional[str] = Field(None, description="备注")


class SparePartPurchaseResponse(SparePartPurchaseBase):
    """备件采购响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
