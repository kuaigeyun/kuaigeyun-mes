"""
工单数据验证Schema模块

定义工单相关的Pydantic数据验证Schema。
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class WorkOrderBase(BaseModel):
    """
    工单基础Schema

    包含所有工单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: str = Field(..., description="工单编码")
    name: str = Field(..., description="工单名称")
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    quantity: Decimal = Field(..., description="计划生产数量")
    production_mode: str = Field("MTS", description="生产模式（MTS/MTO）")

    # MTO模式可选字段
    sales_order_id: Optional[int] = Field(None, description="销售订单ID（MTO模式）")
    sales_order_code: Optional[str] = Field(None, description="销售订单编码")
    sales_order_name: Optional[str] = Field(None, description="销售订单名称")

    # 车间工作中心信息
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, description="车间名称")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, description="工作中心名称")

    # 状态和优先级
    status: str = Field("draft", description="工单状态")
    priority: str = Field("normal", description="优先级")

    # 时间信息
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束时间")

    # 完成信息
    completed_quantity: Decimal = Field(Decimal("0"), description="已完成数量")
    qualified_quantity: Decimal = Field(Decimal("0"), description="合格数量")
    unqualified_quantity: Decimal = Field(Decimal("0"), description="不合格数量")

    # 备注
    remarks: Optional[str] = Field(None, description="备注")


class WorkOrderCreate(WorkOrderBase):
    """
    工单创建Schema

    用于创建新工单的数据验证。
    """
    pass


class WorkOrderUpdate(BaseModel):
    """
    工单更新Schema

    用于更新工单的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="工单名称")
    quantity: Optional[Decimal] = Field(None, description="计划生产数量")
    status: Optional[str] = Field(None, description="工单状态")
    priority: Optional[str] = Field(None, description="优先级")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束时间")
    completed_quantity: Optional[Decimal] = Field(None, description="已完成数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    unqualified_quantity: Optional[Decimal] = Field(None, description="不合格数量")
    remarks: Optional[str] = Field(None, description="备注")


class WorkOrderResponse(WorkOrderBase):
    """
    工单响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="工单ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    created_by: int = Field(..., description="创建人ID")
    created_by_name: str = Field(..., description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class WorkOrderListResponse(BaseModel):
    """
    工单列表响应Schema

    用于工单列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="工单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="工单编码")
    name: str = Field(..., description="工单名称")
    product_name: str = Field(..., description="产品名称")
    quantity: Decimal = Field(..., description="计划生产数量")
    production_mode: str = Field(..., description="生产模式")
    sales_order_code: Optional[str] = Field(None, description="销售订单编码")
    status: str = Field(..., description="工单状态")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    completed_quantity: Decimal = Field(..., description="已完成数量")
    created_by_name: str = Field(..., description="创建人姓名")
    created_at: datetime = Field(..., description="创建时间")


class MaterialShortageItem(BaseModel):
    """缺料明细项"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    required_quantity: float = Field(..., description="需求数量")
    available_quantity: float = Field(..., description="可用库存")
    shortage_quantity: float = Field(..., description="缺料数量")
    unit: str = Field(..., description="单位")


class MaterialShortageResponse(BaseModel):
    """缺料检测响应Schema"""
    has_shortage: bool = Field(..., description="是否有缺料")
    shortage_items: list[MaterialShortageItem] = Field(default_factory=list, description="缺料明细列表")
    total_shortage_count: int = Field(..., description="缺料物料总数")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    work_order_name: str = Field(..., description="工单名称")
