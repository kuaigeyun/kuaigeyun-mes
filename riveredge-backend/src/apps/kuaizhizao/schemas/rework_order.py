"""
返工单数据验证Schema模块

定义返工单相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2026-01-05
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class ReworkOrderBase(BaseModel):
    """
    返工单基础Schema

    包含所有返工单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="返工单编码（可选，创建时自动生成）")
    original_work_order_id: Optional[int] = Field(None, description="原工单ID（关联WorkOrder）")
    original_work_order_uuid: Optional[str] = Field(None, max_length=36, description="原工单UUID")
    original_work_order_code: Optional[str] = Field(None, max_length=50, description="原工单号（展示用，关联查询）")
    
    # 产品信息
    product_id: int = Field(..., description="产品ID（关联物料）")
    product_code: str = Field(..., max_length=50, description="产品编码")
    product_name: str = Field(..., max_length=200, description="产品名称")
    
    # 返工数量
    quantity: Decimal = Field(..., description="返工数量")
    
    # 返工原因和类型
    rework_reason: str = Field(..., description="返工原因")
    rework_type: str = Field(..., max_length=50, description="返工类型（返工、返修、报废）")
    
    # 返工工艺
    route_id: Optional[int] = Field(None, description="返工工艺路线ID（关联物料）")
    route_name: Optional[str] = Field(None, max_length=200, description="返工工艺路线名称")
    
    # 计划时间
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    
    # 工作中心
    work_center_id: Optional[int] = Field(None, description="工作中心ID（关联物料）")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    
    # 操作员
    operator_id: Optional[int] = Field(None, description="操作员ID（用户ID）")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作员姓名")
    
    # 备注
    remarks: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class ReworkOrderOperationItem(BaseModel):
    """返工单关联工序项（用于响应）"""
    work_order_operation_id: int = Field(..., description="工单工序ID")
    operation_code: Optional[str] = Field(None, description="工序编码")
    operation_name: Optional[str] = Field(None, description="工序名称")
    sequence: Optional[int] = Field(None, description="工序顺序")
    is_start: bool = Field(False, description="是否为创建时指定的返工起始工序")


class ReworkOrderCreate(ReworkOrderBase):
    """
    返工单创建Schema

    用于创建新返工单的数据验证。
    """
    code: Optional[str] = Field(None, description="返工单编码（可选，如果不提供则自动生成）")
    start_work_order_operation_id: Optional[int] = Field(
        None, description="返工起始工序 ID（不选则取原工单首道工序）"
    )


class ReworkOrderUpdate(BaseModel):
    """
    返工单更新Schema

    用于更新返工单的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    product_id: Optional[int] = Field(None, description="产品ID")
    product_code: Optional[str] = Field(None, max_length=50, description="产品编码")
    product_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    quantity: Optional[Decimal] = Field(None, description="返工数量")
    rework_reason: Optional[str] = Field(None, description="返工原因")
    rework_type: Optional[str] = Field(None, max_length=50, description="返工类型")
    status: Optional[str] = Field(None, max_length=20, description="返工状态")
    route_id: Optional[int] = Field(None, description="返工工艺路线ID")
    route_name: Optional[str] = Field(None, max_length=200, description="返工工艺路线名称")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    operator_id: Optional[int] = Field(None, description="操作员ID")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作员姓名")
    cost: Optional[Decimal] = Field(None, description="返工成本")
    remarks: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    start_work_order_operation_id: Optional[int] = Field(
        None, description="返工起始工序 ID（不选则取原工单首道工序）"
    )


class ReworkOrderResponse(ReworkOrderBase):
    """
    返工单响应Schema

    用于返回返工单的完整信息。
    """
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="业务ID（UUID）")
    tenant_id: int = Field(..., description="组织ID")
    start_work_order_operation_id: Optional[int] = Field(None, description="返工起始工序 ID")
    status: str = Field(..., description="返工状态（draft/released/in_progress/completed/cancelled）")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    cost: Decimal = Field(Decimal("0"), description="返工成本")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    rework_operations: Optional[List[ReworkOrderOperationItem]] = Field(
        None, description="返工起始工序（仅一道，创建时指定）"
    )


class ReworkOrderListResponse(BaseModel):
    """
    返工单列表响应Schema

    用于返回返工单列表的简化信息。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    original_work_order_id: Optional[int]
    original_work_order_uuid: Optional[str]
    original_work_order_code: Optional[str] = None
    product_id: int
    product_code: str
    product_name: str
    quantity: Decimal
    rework_reason: str
    rework_type: str
    status: str
    planned_start_date: Optional[datetime]
    planned_end_date: Optional[datetime]
    work_center_name: Optional[str]
    operator_name: Optional[str]
    cost: Decimal
    created_at: datetime
    updated_at: datetime
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")


class ReworkOrderFromWorkOrderRequest(BaseModel):
    """
    从工单创建返工单请求Schema
    """
    rework_reason: str = Field(..., description="返工原因")
    rework_type: str = Field(..., max_length=50, description="返工类型（返工、返修、报废）")
    quantity: Optional[Decimal] = Field(None, description="返工数量（如果不提供则使用原工单数量）")
    route_id: Optional[int] = Field(None, description="返工工艺路线ID（如果不提供则使用原工单工艺路线）")
    work_center_id: Optional[int] = Field(None, description="工作中心ID（如果不提供则使用原工单工作中心）")
    start_work_order_operation_id: Optional[int] = Field(
        None, description="返工起始工序 ID（不选则取原工单首道工序）"
    )
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    remarks: Optional[str] = Field(None, description="备注")


class ReworkReportingCreate(BaseModel):
    """返工单报工请求"""
    work_order_operation_id: int = Field(..., description="原工单工序 ID")
    worker_id: int = Field(..., description="操作工 ID")
    worker_name: str = Field(..., description="操作工姓名")
    reported_quantity: Decimal = Field(..., description="报工数量")
    qualified_quantity: Decimal = Field(..., description="合格数量")
    unqualified_quantity: Decimal = Field(..., description="不合格数量")
    work_hours: Decimal = Field(Decimal("0"), description="工时（小时）")
    reported_at: datetime = Field(..., description="报工时间")
    remarks: Optional[str] = Field(None, description="备注")


class ReworkReportingOptionItem(BaseModel):
    """返工报工可选工序"""
    work_order_operation_id: int
    operation_code: Optional[str] = None
    operation_name: Optional[str] = None
    sequence: Optional[int] = None
    is_start_operation: bool = False
    reported_quantity: Decimal = Decimal("0")
    selectable: bool = True


class ReworkReportingOptionsResponse(BaseModel):
    """返工报工选项"""
    rework_order_id: int
    rework_order_code: str
    rework_quantity: Decimal
    start_work_order_operation_id: int
    start_operation_name: Optional[str] = None
    has_start_report: bool
    total_qualified_quantity: Decimal
    remaining_rework_quantity: Decimal
    operations: List[ReworkReportingOptionItem]
