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
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


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
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


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
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")


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
    warehouse_id: Optional[int] = Field(None, description="拣选源仓库ID，空则按工单解析")
    warehouse_name: Optional[str] = Field(None, description="拣选源仓库名称")
    batching_date: Optional[datetime] = Field(None, description="配料日期")
    target_warehouse_id: Optional[int] = Field(None, description="目标线边仓ID，空则按工单解析")
    target_warehouse_name: Optional[str] = Field(None, description="目标线边仓名称")
    remarks: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    allow_existing_draft: bool = Field(False, description="若已有草稿配料单则返回已有单")


class BatchingOrderConfirmItemBatch(BaseModel):
    item_id: int = Field(..., description="配料明细ID")
    batch_no: Optional[str] = Field(None, description="批号（跳过配料时可空）")
    pick_quantity: Optional[Decimal] = Field(None, description="本次配料数量，空则按需求数量")
    skip: bool = Field(False, description="本次不配料")


class BatchingOrderConfirmRequest(BaseModel):
    item_batches: Optional[List[BatchingOrderConfirmItemBatch]] = Field(
        None, description="确认配料时各明细（可部分配料或跳过行）"
    )


class BatchingCenterTaskItem(BaseModel):
    task_type: str = Field(..., description="proactive_prep|material_call|batching_draft|backflush_alert")
    task_id: int = Field(..., description="业务主键")
    doc_code: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    product_name: Optional[str] = None
    picking_score: Optional[float] = None
    picking_rank_band: Optional[str] = None
    kitting_rate: Optional[float] = None
    shortage_summary: Optional[str] = None
    priority: Optional[str] = None
    sla_overdue: bool = False
    status: Optional[str] = None
    material_name: Optional[str] = None
    material_code: Optional[str] = None
    requested_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    caller_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    score_breakdown: Optional[dict] = None
    suggested_warehouse_id: Optional[int] = None
    suggested_warehouse_name: Optional[str] = None
    items: Optional[List[dict]] = Field(None, description="叫料/配料明细（展开用）")
    error_message: Optional[str] = None


class BatchingCenterTaskListResponse(BaseModel):
    items: List[BatchingCenterTaskItem] = Field(default_factory=list)
    total: int = 0


BatchingOrderCreateWithItems.model_rebuild()
