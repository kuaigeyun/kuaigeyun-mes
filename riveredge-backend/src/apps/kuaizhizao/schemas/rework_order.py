"""
返工单数据验证Schema模块

定义返工单相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2026-01-04
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class ReworkOrderBase(BaseModel):
    """
    返工单基础Schema

    包含所有返工单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="返工单编码（可选，创建时自动生成）")
    original_work_order_id: Optional[int] = Field(None, description="原工单ID")
    original_work_order_uuid: Optional[str] = Field(None, description="原工单UUID")
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    quantity: Decimal = Field(..., description="返工数量")
    rework_reason: str = Field(..., description="返工原因")
    rework_type: str = Field(..., description="返工类型（返工、返修、报废）")

    # 状态
    status: str = Field("draft", description="返工单状态（draft/released/in_progress/completed/cancelled）")

    # 时间信息
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")

    # 车间工作中心信息
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, description="车间名称")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, description="工作中心名称")

    # 完成信息
    completed_quantity: Decimal = Field(Decimal("0"), description="已完成数量")
    qualified_quantity: Decimal = Field(Decimal("0"), description="合格数量")
    unqualified_quantity: Decimal = Field(Decimal("0"), description="不合格数量")

    # 备注
    remarks: Optional[str] = Field(None, description="备注")


class ReworkOrderCreate(ReworkOrderBase):
    """
    返工单创建Schema

    用于创建新返工单的数据验证。
    """
    code: Optional[str] = Field(None, description="返工单编码（可选，如果不提供则自动生成）")


class ReworkOrderUpdate(BaseModel):
    """
    返工单更新Schema

    用于更新返工单的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    quantity: Optional[Decimal] = Field(None, description="返工数量")
    rework_reason: Optional[str] = Field(None, description="返工原因")
    rework_type: Optional[str] = Field(None, description="返工类型")
    status: Optional[str] = Field(None, description="返工单状态")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    completed_quantity: Optional[Decimal] = Field(None, description="已完成数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    unqualified_quantity: Optional[Decimal] = Field(None, description="不合格数量")
    remarks: Optional[str] = Field(None, description="备注")


class ReworkOrderResponse(ReworkOrderBase):
    """
    返工单响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="返工单ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    created_by: int = Field(..., description="创建人ID")
    created_by_name: str = Field(..., description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class ReworkOrderListResponse(BaseModel):
    """
    返工单列表响应Schema

    用于返工单列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="返工单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="返工单编码")
    original_work_order_id: Optional[int] = Field(None, description="原工单ID")
    original_work_order_uuid: Optional[str] = Field(None, description="原工单UUID")
    product_name: str = Field(..., description="产品名称")
    quantity: Decimal = Field(..., description="返工数量")
    rework_reason: str = Field(..., description="返工原因")
    rework_type: str = Field(..., description="返工类型")
    status: str = Field(..., description="返工单状态")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    created_at: datetime = Field(..., description="创建时间")

