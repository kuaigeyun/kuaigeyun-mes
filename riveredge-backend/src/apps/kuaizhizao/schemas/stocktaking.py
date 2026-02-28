"""
库存盘点单数据验证Schema模块

定义库存盘点单相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class StocktakingBase(BaseModel):
    """
    库存盘点单基础Schema

    包含所有库存盘点单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., description="仓库名称")
    stocktaking_date: datetime = Field(..., description="盘点日期")
    stocktaking_type: str = Field("full", description="盘点类型（full/partial/cycle）")
    remarks: Optional[str] = Field(None, description="备注")


class StocktakingCreate(StocktakingBase):
    """
    库存盘点单创建Schema

    用于创建新库存盘点单的数据验证。
    """
    pass


class StocktakingUpdate(BaseModel):
    """
    库存盘点单更新Schema

    用于更新库存盘点单的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    stocktaking_date: Optional[datetime] = Field(None, description="盘点日期")
    stocktaking_type: Optional[str] = Field(None, description="盘点类型")
    remarks: Optional[str] = Field(None, description="备注")


class StocktakingResponse(StocktakingBase):
    """
    库存盘点单响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="盘点单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="盘点单号")
    status: str = Field(..., description="状态")
    total_items: int = Field(..., description="盘点物料总数")
    counted_items: int = Field(..., description="已盘点物料数")
    total_differences: int = Field(..., description="差异总数")
    total_difference_amount: Decimal = Field(..., description="差异总金额")
    approved_by: Optional[int] = Field(None, description="审核人ID")
    approved_by_name: Optional[str] = Field(None, description="审核人姓名")
    approved_at: Optional[datetime] = Field(None, description="审核时间")
    completed_by: Optional[int] = Field(None, description="完成人ID")
    completed_by_name: Optional[str] = Field(None, description="完成人姓名")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")


class StocktakingListResponse(BaseModel):
    """
    库存盘点单列表响应Schema

    用于库存盘点单列表API的响应数据格式。
    """
    items: List[StocktakingResponse] = Field(default_factory=list, description="盘点单列表")
    total: int = Field(..., description="总数")


class StocktakingItemBase(BaseModel):
    """
    库存盘点明细基础Schema

    包含所有库存盘点明细的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    stocktaking_id: int = Field(..., description="盘点单ID")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    warehouse_id: int = Field(..., description="仓库ID")
    location_id: Optional[int] = Field(None, description="库位ID（可选）")
    location_code: Optional[str] = Field(None, description="库位编码（可选）")
    batch_no: Optional[str] = Field(None, description="批次号（可选）")
    book_quantity: Optional[Decimal] = Field(None, description="账面数量（不传则从库存服务自动获取）")
    actual_quantity: Optional[Decimal] = Field(None, description="实际数量")
    unit_price: Decimal = Field(default=0, description="单价")
    remarks: Optional[str] = Field(None, description="备注")


class StocktakingItemCreate(StocktakingItemBase):
    """
    库存盘点明细创建Schema

    用于创建新库存盘点明细的数据验证。
    """
    pass


class StocktakingItemUpdate(BaseModel):
    """
    库存盘点明细更新Schema

    用于更新库存盘点明细的数据验证，主要用于更新实际数量。
    """
    model_config = ConfigDict(from_attributes=True)

    actual_quantity: Optional[Decimal] = Field(None, description="实际数量")
    remarks: Optional[str] = Field(None, description="备注")


class StocktakingItemResponse(StocktakingItemBase):
    """
    库存盘点明细响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="盘点明细ID")
    uuid: str = Field(..., description="业务ID")
    difference_quantity: Decimal = Field(..., description="差异数量")
    difference_amount: Decimal = Field(..., description="差异金额")
    counted_by: Optional[int] = Field(None, description="盘点人ID")
    counted_by_name: Optional[str] = Field(None, description="盘点人姓名")
    counted_at: Optional[datetime] = Field(None, description="盘点时间")
    status: str = Field(..., description="状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class StocktakingItemListResponse(StocktakingItemResponse):
    """
    库存盘点明细列表响应Schema

    用于库存盘点明细列表API的响应数据格式。
    """
    pass


class StocktakingWithItemsResponse(StocktakingResponse):
    """
    带明细的库存盘点单响应Schema

    用于返回盘点单及其明细的完整信息。
    """
    items: List[StocktakingItemResponse] = Field(default_factory=list, description="盘点明细列表")

