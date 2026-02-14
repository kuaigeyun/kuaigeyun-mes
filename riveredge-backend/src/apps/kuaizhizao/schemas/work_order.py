"""
工单数据验证Schema模块

定义工单相关的Pydantic数据验证Schema。
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal

if TYPE_CHECKING:
    from typing import ForwardRef


class WorkOrderBase(BaseModel):
    """
    工单基础Schema

    包含所有工单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="工单编码（必填，可通过编码规则自动生成）")
    name: Optional[str] = Field(None, description="工单名称（可选）")
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
    
    # 指定结束标记
    manually_completed: bool = Field(False, description="是否指定结束（true:手动指定结束, false:正常完成）")
    
    # 工序跳转控制
    allow_operation_jump: bool = Field(False, description="是否允许跳转工序（true:允许自由报工, false:下一道工序报工数量不可超过上一道工序）")
    
    # 冻结信息
    is_frozen: bool = Field(False, description="是否冻结")
    freeze_reason: Optional[str] = Field(None, description="冻结原因")
    frozen_at: Optional[datetime] = Field(None, description="冻结时间")
    frozen_by: Optional[int] = Field(None, description="冻结人ID")
    frozen_by_name: Optional[str] = Field(None, description="冻结人姓名")

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
    
    注意：
    - product_id 和 product_code 至少提供一个
    - 如果提供 product_id，product_code 和 product_name 将被自动填充
    - 如果只提供 product_code，product_id 将被自动查找
    - code 和 code_rule 至少提供一个：如果提供 code 则手工填写，如果提供 code_rule 则使用编码规则生成
    - operations: 可选，如果提供则使用提供的工序，否则自动匹配工艺路线生成工序
    """
    code: Optional[str] = Field(None, description="工单编码（可选，如果未提供 code_rule 则为必填）")
    code_rule: Optional[str] = Field(None, description="编码规则代码（可选，如果未提供 code 则为必填）")
    product_id: Optional[int] = Field(None, description="产品ID（可选，如果未提供则根据 product_code 自动查找）")
    product_code: Optional[str] = Field(None, description="产品编码（可选，如果未提供 product_id 则为必填）")
    product_name: Optional[str] = Field(None, description="产品名称（可选，如果未提供则从物料中获取）")
    operations: Optional[List["WorkOrderOperationCreate"]] = Field(None, description="工单工序列表（可选，如果提供则使用提供的工序，否则自动匹配工艺路线生成）")


class WorkOrderBatchUpdateDatesItem(BaseModel):
    """批量更新工单计划日期项"""
    work_order_id: int = Field(..., description="工单ID")
    planned_start_date: datetime = Field(..., description="计划开始时间")
    planned_end_date: datetime = Field(..., description="计划结束时间")


class WorkOrderBatchUpdateDatesRequest(BaseModel):
    """批量更新工单计划日期请求"""
    updates: list[WorkOrderBatchUpdateDatesItem] = Field(..., description="更新项列表")


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
    name: Optional[str] = Field(None, description="工单名称（可选）")
    product_name: str = Field(..., description="产品名称")
    quantity: Decimal = Field(..., description="计划生产数量")
    production_mode: str = Field(..., description="生产模式")
    sales_order_code: Optional[str] = Field(None, description="销售订单编码")
    status: str = Field(..., description="工单状态")
    priority: Optional[str] = Field(None, description="优先级")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    completed_quantity: Decimal = Field(default=Decimal("0"), description="已完成数量")
    work_center_name: Optional[str] = Field(None, description="工作中心名称")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
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


class WorkOrderSplitRequest(BaseModel):
    """工单拆分请求Schema"""
    split_type: str = Field(..., description="拆分类型：quantity（按数量拆分）或operation（按工序拆分）")
    split_quantities: Optional[list[Decimal]] = Field(None, description="按数量拆分：每个拆分工单的数量列表")
    split_count: Optional[int] = Field(None, description="按数量拆分：拆分成几个工单（等量拆分）")
    operation_ids: Optional[list[int]] = Field(None, description="按工序拆分：要拆分到新工单的工序ID列表")
    remarks: Optional[str] = Field(None, description="拆分备注")


class WorkOrderSplitResponse(BaseModel):
    """工单拆分响应Schema"""
    original_work_order_id: int = Field(..., description="原工单ID")
    original_work_order_code: str = Field(..., description="原工单编码")
    split_work_orders: list[WorkOrderResponse] = Field(..., description="拆分工单列表")
    total_count: int = Field(..., description="拆分工单总数")


class WorkOrderOperationBase(BaseModel):
    """工单工序基础Schema"""
    model_config = ConfigDict(from_attributes=True)

    work_order_id: Optional[int] = Field(None, description="工单ID（创建工单时不需要，创建工序单时需要）")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., max_length=50, description="工序编码")
    operation_name: str = Field(..., max_length=200, description="工序名称")
    sequence: int = Field(..., description="工序顺序（从1开始）")
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, max_length=200, description="车间名称")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    standard_time: Optional[Decimal] = Field(None, description="标准工时（小时/件）")
    setup_time: Optional[Decimal] = Field(None, description="准备时间（小时）")
    
    # 派工信息
    assigned_worker_id: Optional[int] = Field(None, description="分配的员工ID")
    assigned_worker_name: Optional[str] = Field(None, description="分配的员工姓名")
    assigned_equipment_id: Optional[int] = Field(None, description="分配的设备ID")
    assigned_equipment_name: Optional[str] = Field(None, description="分配的设备姓名")
    assigned_at: Optional[datetime] = Field(None, description="分配时间")
    
    remarks: Optional[str] = Field(None, description="备注")


class WorkOrderOperationDispatch(BaseModel):
    """工单工序派工请求Schema"""
    assigned_worker_id: Optional[int] = Field(None, description="分配的员工ID")
    assigned_worker_name: Optional[str] = Field(None, description="分配的员工姓名")
    assigned_equipment_id: Optional[int] = Field(None, description="分配的设备ID")
    assigned_equipment_name: Optional[str] = Field(None, description="分配的设备姓名")
    remarks: Optional[str] = Field(None, description="派工备注")


class WorkOrderOperationCreate(WorkOrderOperationBase):
    """创建工单工序Schema"""
    pass


class WorkOrderOperationUpdate(BaseModel):
    """更新工单工序Schema"""
    model_config = ConfigDict(from_attributes=True)

    operation_id: Optional[int] = Field(None, description="工序ID")
    sequence: Optional[int] = Field(None, description="工序顺序")
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, max_length=200, description="车间名称")
    work_center_id: Optional[int] = Field(None, description="工作中心ID")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    standard_time: Optional[Decimal] = Field(None, description="标准工时（小时/件）")
    setup_time: Optional[Decimal] = Field(None, description="准备时间（小时）")
    remarks: Optional[str] = Field(None, description="备注")


class WorkOrderOperationResponse(WorkOrderOperationBase):
    """工单工序响应Schema"""
    id: int = Field(..., description="工单工序ID")
    uuid: str = Field(..., description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    work_order_code: str = Field(..., max_length=50, description="工单编码")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束时间")
    completed_quantity: Decimal = Field(Decimal("0"), description="已完成数量")
    qualified_quantity: Decimal = Field(Decimal("0"), description="合格数量")
    unqualified_quantity: Decimal = Field(Decimal("0"), description="不合格数量")
    status: str = Field(..., max_length=20, description="工序状态")
    
    # 派工审计信息
    assigned_by: Optional[int] = Field(None, description="分配人ID")
    assigned_by_name: Optional[str] = Field(None, description="分配人姓名")
    
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class WorkOrderOperationsUpdateRequest(BaseModel):
    """工单工序批量更新请求Schema"""
    operations: list[WorkOrderOperationCreate] = Field(..., description="工序列表")


class WorkOrderFreezeRequest(BaseModel):
    """工单冻结请求Schema"""
    freeze_reason: str = Field(..., description="冻结原因")


class WorkOrderUnfreezeRequest(BaseModel):
    """工单解冻请求Schema"""
    unfreeze_reason: Optional[str] = Field(None, description="解冻原因（可选）")


class WorkOrderPriorityRequest(BaseModel):
    """工单优先级设置请求Schema"""
    priority: str = Field(..., description="优先级（low/normal/high/urgent）")


class WorkOrderBatchPriorityRequest(BaseModel):
    """工单批量优先级设置请求Schema"""
    work_order_ids: list[int] = Field(..., description="工单ID列表")
    priority: str = Field(..., description="优先级（low/normal/high/urgent）")


class WorkOrderMergeRequest(BaseModel):
    """工单合并请求Schema"""
    work_order_ids: list[int] = Field(..., min_length=2, description="要合并的工单ID列表（至少2个）")
    remarks: Optional[str] = Field(None, description="合并备注")


class WorkOrderMergeResponse(BaseModel):
    """工单合并响应Schema"""
    merged_work_order: WorkOrderResponse = Field(..., description="合并后的工单")
    original_work_order_ids: list[int] = Field(..., description="原工单ID列表")
    original_work_order_codes: list[str] = Field(..., description="原工单编码列表")


# 更新前向引用（Pydantic v2 需要）
WorkOrderCreate.model_rebuild()
