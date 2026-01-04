"""
委外单数据验证Schema模块

定义委外单相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class OutsourceOrderBase(BaseModel):
    """
    委外单基础Schema

    包含所有委外单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="委外单编码（可选，创建时自动生成）")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    work_order_operation_id: int = Field(..., description="工单工序ID")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., description="工序编码")
    operation_name: str = Field(..., description="工序名称")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_code: str = Field(..., description="供应商编码")
    supplier_name: str = Field(..., description="供应商名称")
    outsource_quantity: Decimal = Field(..., description="委外数量")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    total_amount: Decimal = Field(Decimal("0"), description="总金额")

    # 时间信息
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")

    # 状态信息
    status: str = Field("draft", description="委外单状态（draft/released/in_progress/completed/cancelled）")

    # 完成信息
    received_quantity: Decimal = Field(Decimal("0"), description="已接收数量")
    qualified_quantity: Decimal = Field(Decimal("0"), description="合格数量")
    unqualified_quantity: Decimal = Field(Decimal("0"), description="不合格数量")

    # 采购入库关联
    purchase_receipt_id: Optional[int] = Field(None, description="采购入库单ID")
    purchase_receipt_code: Optional[str] = Field(None, description="采购入库单编码")

    # 备注
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceOrderCreate(OutsourceOrderBase):
    """
    委外单创建Schema

    用于创建新委外单的数据验证。
    """
    code: Optional[str] = Field(None, description="委外单编码（可选，如果不提供则自动生成）")


class OutsourceOrderUpdate(BaseModel):
    """
    委外单更新Schema

    用于更新委外单的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_code: Optional[str] = Field(None, description="供应商编码")
    supplier_name: Optional[str] = Field(None, description="供应商名称")
    outsource_quantity: Optional[Decimal] = Field(None, description="委外数量")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    total_amount: Optional[Decimal] = Field(None, description="总金额")
    status: Optional[str] = Field(None, description="委外单状态")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    received_quantity: Optional[Decimal] = Field(None, description="已接收数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    unqualified_quantity: Optional[Decimal] = Field(None, description="不合格数量")
    purchase_receipt_id: Optional[int] = Field(None, description="采购入库单ID")
    purchase_receipt_code: Optional[str] = Field(None, description="采购入库单编码")
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceOrderResponse(OutsourceOrderBase):
    """
    委外单响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="委外单ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class OutsourceOrderListResponse(BaseModel):
    """
    委外单列表响应Schema

    用于委外单列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="委外单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="委外单编码")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    operation_name: str = Field(..., description="工序名称")
    supplier_name: str = Field(..., description="供应商名称")
    outsource_quantity: Decimal = Field(..., description="委外数量")
    received_quantity: Decimal = Field(..., description="已接收数量")
    qualified_quantity: Decimal = Field(..., description="合格数量")
    status: str = Field(..., description="委外单状态")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    total_amount: Decimal = Field(..., description="总金额")
    created_at: datetime = Field(..., description="创建时间")

