"""
库存调拨单数据验证Schema模块

定义库存调拨单相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2026-01-15
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class InventoryTransferBase(BaseModel):
    """
    库存调拨单基础Schema

    包含所有库存调拨单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    from_warehouse_id: int = Field(..., description="调出仓库ID")
    from_warehouse_name: str = Field(..., description="调出仓库名称")
    to_warehouse_id: int = Field(..., description="调入仓库ID")
    to_warehouse_name: str = Field(..., description="调入仓库名称")
    transfer_date: datetime = Field(..., description="调拨日期")
    transfer_reason: Optional[str] = Field(None, description="调拨原因")
    remarks: Optional[str] = Field(None, description="备注")


class InventoryTransferCreate(InventoryTransferBase):
    """
    库存调拨单创建Schema

    用于创建新库存调拨单的数据验证。
    """
    pass


class InventoryTransferUpdate(BaseModel):
    """
    库存调拨单更新Schema

    用于更新库存调拨单的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    from_warehouse_id: Optional[int] = Field(None, description="调出仓库ID")
    from_warehouse_name: Optional[str] = Field(None, description="调出仓库名称")
    to_warehouse_id: Optional[int] = Field(None, description="调入仓库ID")
    to_warehouse_name: Optional[str] = Field(None, description="调入仓库名称")
    transfer_date: Optional[datetime] = Field(None, description="调拨日期")
    transfer_reason: Optional[str] = Field(None, description="调拨原因")
    remarks: Optional[str] = Field(None, description="备注")


class InventoryTransferResponse(InventoryTransferBase):
    """
    库存调拨单响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="调拨单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="调拨单号")
    status: str = Field(..., description="状态")
    total_items: int = Field(..., description="调拨物料总数")
    total_quantity: Decimal = Field(..., description="调拨总数量")
    total_amount: Decimal = Field(..., description="调拨总金额")
    executed_by: Optional[int] = Field(None, description="执行人ID")
    executed_by_name: Optional[str] = Field(None, description="执行人姓名")
    executed_at: Optional[datetime] = Field(None, description="执行时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")


class InventoryTransferListResponse(BaseModel):
    """
    库存调拨单列表响应Schema

    用于库存调拨单列表API的响应数据格式。
    """
    items: List[InventoryTransferResponse] = Field(default_factory=list, description="调拨单列表")
    total: int = Field(..., description="总数")


class InventoryTransferItemBase(BaseModel):
    """
    库存调拨明细基础Schema

    包含所有库存调拨明细的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    transfer_id: int = Field(..., description="调拨单ID")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    from_warehouse_id: int = Field(..., description="调出仓库ID")
    from_location_id: Optional[int] = Field(None, description="调出库位ID（可选）")
    from_location_code: Optional[str] = Field(None, description="调出库位编码（可选）")
    to_warehouse_id: int = Field(..., description="调入仓库ID")
    to_location_id: Optional[int] = Field(None, description="调入库位ID（可选）")
    to_location_code: Optional[str] = Field(None, description="调入库位编码（可选）")
    batch_no: Optional[str] = Field(None, description="批次号（可选）")
    quantity: Decimal = Field(..., description="调拨数量")
    unit_price: Decimal = Field(default=0, description="单价")
    remarks: Optional[str] = Field(None, description="备注")


class InventoryTransferItemCreate(InventoryTransferItemBase):
    """
    库存调拨明细创建Schema

    用于创建新库存调拨明细的数据验证。
    """
    pass


class InventoryTransferItemUpdate(BaseModel):
    """
    库存调拨明细更新Schema

    用于更新库存调拨明细的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    quantity: Optional[Decimal] = Field(None, description="调拨数量")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    remarks: Optional[str] = Field(None, description="备注")


class InventoryTransferItemResponse(InventoryTransferItemBase):
    """
    库存调拨明细响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="调拨明细ID")
    uuid: str = Field(..., description="业务ID")
    amount: Decimal = Field(..., description="金额")
    status: str = Field(..., description="状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class InventoryTransferItemListResponse(InventoryTransferItemResponse):
    """
    库存调拨明细列表响应Schema

    用于库存调拨明细列表API的响应数据格式。
    """
    pass


class InventoryTransferWithItemsResponse(InventoryTransferResponse):
    """
    带明细的库存调拨单响应Schema

    用于返回调拨单及其明细的完整信息。
    """
    items: List[InventoryTransferItemResponse] = Field(default_factory=list, description="调拨明细列表")
