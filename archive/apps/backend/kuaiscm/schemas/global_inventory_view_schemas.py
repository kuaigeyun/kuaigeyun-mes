"""
全局库存视图 Schema 模块

定义全局库存视图相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal


class GlobalInventoryViewBase(BaseModel):
    """全局库存视图基础 Schema"""
    
    view_no: str = Field(..., max_length=100, description="视图编号")
    view_name: str = Field(..., max_length=200, description="视图名称")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    inventory_type: Optional[str] = Field(None, max_length=50, description="库存类型")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, max_length=200, description="仓库名称")
    quantity: Optional[Decimal] = Field(None, description="数量")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    total_value: Optional[Decimal] = Field(None, description="总价值")
    turnover_rate: Optional[Decimal] = Field(None, description="周转率")
    alert_status: str = Field("正常", max_length=50, description="预警状态")
    status: str = Field("正常", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class GlobalInventoryViewCreate(GlobalInventoryViewBase):
    """创建全局库存视图 Schema"""
    pass


class GlobalInventoryViewUpdate(BaseModel):
    """更新全局库存视图 Schema"""
    
    view_name: Optional[str] = Field(None, max_length=200, description="视图名称")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    inventory_type: Optional[str] = Field(None, max_length=50, description="库存类型")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, max_length=200, description="仓库名称")
    quantity: Optional[Decimal] = Field(None, description="数量")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    total_value: Optional[Decimal] = Field(None, description="总价值")
    turnover_rate: Optional[Decimal] = Field(None, description="周转率")
    alert_status: Optional[str] = Field(None, max_length=50, description="预警状态")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class GlobalInventoryViewResponse(GlobalInventoryViewBase):
    """全局库存视图响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

