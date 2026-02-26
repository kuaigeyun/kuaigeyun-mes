"""
组装单数据验证Schema模块

Author: Luigi Lu
Date: 2026-02-26
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class AssemblyOrderBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., description="仓库名称")
    assembly_date: datetime = Field(..., description="组装日期")
    product_material_id: int = Field(..., description="成品物料ID")
    product_material_code: str = Field(..., description="成品物料编码")
    product_material_name: str = Field(..., description="成品物料名称")
    total_quantity: Decimal = Field(0, description="组装数量（成品数量）")
    remarks: Optional[str] = Field(None, description="备注")


class AssemblyOrderCreate(AssemblyOrderBase):
    pass


class AssemblyOrderUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    assembly_date: Optional[datetime] = None
    product_material_id: Optional[int] = None
    product_material_code: Optional[str] = None
    product_material_name: Optional[str] = None
    total_quantity: Optional[Decimal] = None
    remarks: Optional[str] = None


class AssemblyOrderResponse(AssemblyOrderBase):
    id: int = Field(..., description="组装单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="组装单号")
    status: str = Field(..., description="状态")
    total_items: int = Field(..., description="组件明细数")
    executed_by: Optional[int] = Field(None, description="执行人ID")
    executed_by_name: Optional[str] = Field(None, description="执行人姓名")
    executed_at: Optional[datetime] = Field(None, description="执行时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")


class AssemblyOrderListResponse(BaseModel):
    items: List[AssemblyOrderResponse] = Field(default_factory=list)
    total: int = Field(..., description="总数")


class AssemblyOrderItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assembly_order_id: int = Field(..., description="组装单ID")
    material_id: int = Field(..., description="组件物料ID")
    material_code: str = Field(..., description="组件物料编码")
    material_name: str = Field(..., description="组件物料名称")
    quantity: Decimal = Field(..., description="消耗数量")
    unit_price: Decimal = Field(default=0, description="单价")
    remarks: Optional[str] = Field(None, description="备注")


class AssemblyOrderItemCreate(AssemblyOrderItemBase):
    pass


class AssemblyOrderItemCreateInput(BaseModel):
    """API 创建明细时的请求体，assembly_order_id 由路径提供"""
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="组件物料ID")
    material_code: str = Field(..., description="组件物料编码")
    material_name: str = Field(..., description="组件物料名称")
    quantity: Decimal = Field(..., description="消耗数量")
    unit_price: Decimal = Field(default=0, description="单价")
    remarks: Optional[str] = Field(None, description="备注")


class AssemblyOrderItemUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    remarks: Optional[str] = None


class AssemblyOrderItemResponse(AssemblyOrderItemBase):
    id: int = Field(..., description="明细ID")
    uuid: str = Field(..., description="业务ID")
    amount: Decimal = Field(..., description="金额")
    status: str = Field(..., description="状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class AssemblyOrderWithItemsResponse(AssemblyOrderResponse):
    items: List[AssemblyOrderItemResponse] = Field(default_factory=list, description="组装明细列表")
