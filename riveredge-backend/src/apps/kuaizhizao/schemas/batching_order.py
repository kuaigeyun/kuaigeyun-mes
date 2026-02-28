"""
配料单数据验证Schema模块

Author: Luigi Lu
Date: 2026-02-28
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class BatchingOrderBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: int = Field(..., description="拣选源仓库ID")
    warehouse_name: str = Field(..., description="拣选源仓库名称")
    work_order_id: Optional[int] = Field(None, description="关联工单ID")
    work_order_code: Optional[str] = Field(None, description="关联工单编码")
    production_plan_id: Optional[int] = Field(None, description="关联生产计划ID")
    batching_date: datetime = Field(..., description="配料日期")
    target_warehouse_id: Optional[int] = Field(None, description="目标线边仓ID")
    target_warehouse_name: Optional[str] = Field(None, description="目标线边仓名称")
    remarks: Optional[str] = Field(None, description="备注")


class BatchingOrderCreate(BatchingOrderBase):
    pass


class BatchingOrderCreateWithItems(BatchingOrderCreate):
    """手工创建配料单时的请求体（含可选明细）"""
    items: Optional[List["BatchingOrderItemCreate"]] = Field(default=None, description="配料明细（手工创建时必填）")


class BatchingOrderUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    production_plan_id: Optional[int] = None
    batching_date: Optional[datetime] = None
    target_warehouse_id: Optional[int] = None
    target_warehouse_name: Optional[str] = None
    remarks: Optional[str] = None


class BatchingOrderResponse(BatchingOrderBase):
    id: int = Field(..., description="配料单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="配料单号")
    status: str = Field(..., description="状态")
    total_items: int = Field(..., description="物料种类数")
    executed_by: Optional[int] = Field(None, description="执行人ID")
    executed_by_name: Optional[str] = Field(None, description="执行人姓名")
    executed_at: Optional[datetime] = Field(None, description="执行时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")


class BatchingOrderListResponse(BaseModel):
    items: List[BatchingOrderResponse] = Field(default_factory=list)
    total: int = Field(..., description="总数")


class BatchingOrderItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    batching_order_id: int = Field(..., description="配料单ID")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    unit: str = Field(default="", description="单位")
    required_quantity: Decimal = Field(..., description="需求数量")
    picked_quantity: Decimal = Field(default=0, description="已拣数量")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, description="库位编码")
    batch_no: Optional[str] = Field(None, description="批次号")
    remarks: Optional[str] = Field(None, description="备注")


class BatchingOrderItemCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    unit: str = Field(default="", description="单位")
    required_quantity: Decimal = Field(..., description="需求数量")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, description="库位编码")
    batch_no: Optional[str] = Field(None, description="批次号")
    remarks: Optional[str] = Field(None, description="备注")


class BatchingOrderItemUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    picked_quantity: Optional[Decimal] = None
    location_id: Optional[int] = None
    location_code: Optional[str] = None
    batch_no: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class BatchingOrderItemResponse(BatchingOrderItemBase):
    id: int = Field(..., description="明细ID")
    uuid: str = Field(..., description="业务ID")
    status: str = Field(..., description="状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class BatchingOrderWithItemsResponse(BatchingOrderResponse):
    items: List[BatchingOrderItemResponse] = Field(default_factory=list, description="配料明细列表")


class PullFromWorkOrderRequest(BaseModel):
    work_order_id: int = Field(..., description="工单ID")
    warehouse_id: int = Field(..., description="拣选源仓库ID")
    warehouse_name: str = Field(..., description="拣选源仓库名称")
    batching_date: Optional[datetime] = Field(None, description="配料日期")
    target_warehouse_id: Optional[int] = Field(None, description="目标线边仓ID")
    target_warehouse_name: Optional[str] = Field(None, description="目标线边仓名称")
    remarks: Optional[str] = Field(None, description="备注")


BatchingOrderCreateWithItems.model_rebuild()
