"""
工单数据验证Schema模块

定义工单相关的Pydantic数据验证Schema。
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal

from core.schemas.base import BaseSchema
from apps.kuaizhizao.services.document_action_policy.types import WorkOrderCapabilities

if TYPE_CHECKING:
    from typing import ForwardRef


class WorkOrderBase(BaseSchema):
    """
    工单基础Schema

    包含所有工单的基本字段。
    """
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
    )

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

    # 审核信息（UniAudit）
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: Optional[str] = Field(None, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    
    # 指定结束标记
    manually_completed: bool = Field(False, description="是否指定结束（true:手动指定结束, false:正常完成）")
    
    # 工序跳转控制（快照；创建时默认来自来源工艺路线）
    allow_operation_jump: bool = Field(False, description="是否允许跳转工序（true:允许自由报工, false:下一道工序报工数量不可超过上一道工序）")

    # 来源工艺路线（可选，持久化）
    process_route_id: Optional[int] = Field(None, alias="processRouteId", description="来源工艺路线ID")

    # 超报（工单头默认，工序行可覆盖）
    over_report_mode: str = Field("none", alias="overReportMode", description="超报模式：none/fixed/percent")
    over_report_value: Decimal = Field(Decimal("0"), alias="overReportValue", description="超报值：fixed 为额外数量，percent 为百分数")
    
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

    # 配置件属性
    variant_attributes: Optional[dict] = Field(None, description="属性（配置件专用）")
    configurable_selections: Optional[dict] = Field(None, description="配置位选择（BOM配置位，格式 {\"parentMaterialId_configurableGroupId\": componentId}）")

    # 备注和附件
    remarks: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")

    # 批号/序列号追踪（模式由物料主数据决定，此处为赋值）
    tracking_mode: Optional[str] = Field(None, description="追踪模式 none/batch/serial/both")
    planned_batch_no: Optional[str] = Field(None, description="计划批号")
    confirmed_batch_no: Optional[str] = Field(None, description="确认批号")
    planned_serial_no: Optional[str] = Field(None, description="计划序列号（子工单）")
    confirmed_serial_no: Optional[str] = Field(None, description="确认序列号")
    batch_rule_id: Optional[int] = Field(None, description="批号规则ID")
    serial_rule_id: Optional[int] = Field(None, description="序列号规则ID")
    effective_batch_no: Optional[str] = Field(None, description="有效批号（确认优先，回落计划）")
    effective_serial_no: Optional[str] = Field(None, description="有效序列号（确认优先，回落计划）")


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
    - allow_operation_jump 为 None 时，默认采用来源工艺路线的路线级设置（无路线则为 False）
    """
    allow_operation_jump: Optional[bool] = Field(
        None,
        description="是否允许跳转工序；不传则采用工艺路线默认值",
    )
    code: Optional[str] = Field(None, description="工单编码（可选，如果未提供 code_rule 则为必填）")
    code_rule: Optional[str] = Field(None, description="编码规则代码（可选，如果未提供 code 则为必填）")
    product_id: Optional[int] = Field(None, description="产品ID（可选，如果未提供则根据 product_code 自动查找）")
    product_code: Optional[str] = Field(None, description="产品编码（可选，如果未提供 product_id 则为必填）")
    product_name: Optional[str] = Field(None, description="产品名称（可选，如果未提供则从物料中获取）")
    operations: Optional[List["WorkOrderOperationCreate"]] = Field(None, description="工单工序列表（可选，如果提供则使用提供的工序，否则自动匹配工艺路线生成）")
    variant_attributes: Optional[dict] = Field(None, description="属性（配置件产品必填，如 {\"color\":\"red\",\"size\":\"M\"}）")
    configurable_selections: Optional[dict] = Field(None, description="配置位选择（BOM配置位，格式 {\"parentMaterialId_configurableGroupId\": componentId}）")
    # 批号/序列号（追踪模式由物料主数据驱动）
    enable_production_tracking: Optional[bool] = Field(
        None, description="开单时是否启用投产批号/序列号"
    )
    tracking_assign_mode: Optional[str] = Field(
        None, description="投产方式 batch/serial/both，决定普通工单或按件拆分子工单"
    )
    planned_batch_no: Optional[str] = Field(None, description="计划批号（手工录入）")
    planned_serial_nos: Optional[List[str]] = Field(None, description="计划序列号列表（序列号物料，数量须等于 quantity）")
    batch_rule_id: Optional[int] = Field(None, description="批号规则ID（覆盖物料默认）")
    serial_rule_id: Optional[int] = Field(None, description="序列号规则ID（覆盖物料默认）")


class WorkOrderBatchUpdateDatesItem(BaseModel):
    """批量更新工单计划日期项"""
    work_order_id: int = Field(..., description="工单ID")
    planned_start_date: datetime = Field(..., description="计划开始时间")
    planned_end_date: datetime = Field(..., description="计划结束时间")


class WorkOrderBatchUpdateDatesRequest(BaseModel):
    """批量更新工单计划日期请求"""
    updates: list[WorkOrderBatchUpdateDatesItem] = Field(..., description="更新项列表")


class DefaultOperatorSnapshot(BaseModel):
    """工序档案默认生产人员（用于报工默认与下拉「默认」标记）"""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="用户ID")
    uuid: str = Field(..., description="用户UUID")
    name: str = Field(..., description="展示名称")


class WorkOrderOperationBatchUpdateDatesItem(BaseModel):
    """批量更新工序计划日期项"""
    operation_id: int = Field(..., description="工序ID（WorkOrderOperation.id）")
    planned_start_date: datetime = Field(..., description="计划开始时间")
    planned_end_date: datetime = Field(..., description="计划结束时间")


class WorkOrderOperationBatchUpdateDatesRequest(BaseModel):
    """批量更新工序计划日期请求（工序级派工）"""
    updates: list[WorkOrderOperationBatchUpdateDatesItem] = Field(..., description="更新项列表")


class WorkOrderOperationBatchUpdateStationsItem(BaseModel):
    """批量更新工序指派工位项"""
    operation_id: int = Field(..., description="工序ID")
    assigned_station_id: int = Field(..., description="工位ID")


class WorkOrderOperationBatchUpdateStationsRequest(BaseModel):
    """批量更新工序指派工位请求"""
    updates: list[WorkOrderOperationBatchUpdateStationsItem] = Field(..., description="更新项列表")


class WorkOrderOperationBatchUpdateAssignmentsItem(BaseModel):
    """批量更新工序派工资源项（人员/设备/模具/工装）"""
    operation_id: int = Field(..., description="工序ID（WorkOrderOperation.id）")
    assigned_worker_id: Optional[int] = Field(None, description="分配的员工ID")
    assigned_team_id: Optional[int] = Field(None, description="分配的工作小组ID")
    assigned_equipment_id: Optional[int] = Field(None, description="分配的设备ID")
    assigned_mold_id: Optional[int] = Field(None, description="分配的模具ID")
    assigned_tool_id: Optional[int] = Field(None, description="分配的工装ID")


class WorkOrderOperationBatchUpdateAssignmentsRequest(BaseModel):
    """批量更新工序派工资源请求"""
    updates: list[WorkOrderOperationBatchUpdateAssignmentsItem] = Field(..., description="更新项列表")


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
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    over_report_mode: Optional[str] = Field(None, alias="overReportMode", description="超报模式：none/fixed/percent")
    over_report_value: Optional[Decimal] = Field(None, alias="overReportValue", description="超报值")
    allow_operation_jump: Optional[bool] = Field(None, description="是否允许跳转工序")
    process_route_id: Optional[int] = Field(None, alias="processRouteId", description="来源工艺路线ID")
    planned_batch_no: Optional[str] = Field(None, description="计划批号")
    confirmed_batch_no: Optional[str] = Field(None, description="确认批号")
    planned_serial_no: Optional[str] = Field(None, description="计划序列号")
    confirmed_serial_no: Optional[str] = Field(None, description="确认序列号")


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
    external_sync_at: Optional[datetime] = Field(
        None, description="最近从外部接口/数据集同步时间", serialization_alias="externalSyncAt"
    )
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    manufacturing_mode: Optional[str] = Field(
        None,
        description="制造模式（fabrication/assembly）：定义在物料主数据；工单 product_id 指向本单制造的产品物料，由后端从该物料 source_config 解析",
    )
    material_spec: Optional[str] = Field(
        None,
        description="产品规格（来自物料主数据 specification）",
    )
    split_remaining_quantity: Optional[Decimal] = Field(
        None,
        description="拆分剩余可分配数量（已拆分主工单：原数量减去子工单数量之和）",
    )
    work_order_group_id: Optional[int] = Field(None, description="所属工单组 ID")
    group_role: Optional[str] = Field(None, description="组内角色")
    bom_parent_work_order_id: Optional[int] = Field(None, description="BOM 上级工单 ID")
    demand_item_id: Optional[int] = Field(None, description="需求行 ID")
    supply_mode: Optional[str] = Field(None, description="供应模式 stocked/direct")
    serial_split_child_count: Optional[int] = Field(
        None, description="序列号自动拆分子工单数量（仅父单）"
    )
    capabilities: Optional[WorkOrderCapabilities] = Field(
        None, description="业务态动作能力（document_action_policy）"
    )
    base_unit: Optional[str] = Field(None, description="产品基础单位（物料主数据）")
    product_unit: Optional[str] = Field(None, description="生产场景单位（未配置时等于基础单位）")
    unit_to_base_factor: Optional[float] = Field(
        None,
        description="生产单位到基础单位换算因子：1生产单位=factor×1基础单位",
    )
    display_quantity: Optional[Decimal] = Field(
        None, description="计划数量（按生产单位换算后的展示值）"
    )
    display_split_remaining_quantity: Optional[Decimal] = Field(
        None, description="拆分剩余数量（生产单位）"
    )
    display_completed_quantity: Optional[Decimal] = Field(
        None, description="已完成数量（生产单位）"
    )
    display_qualified_quantity: Optional[Decimal] = Field(
        None, description="合格数量（生产单位）"
    )
    display_unqualified_quantity: Optional[Decimal] = Field(
        None, description="不合格数量（生产单位）"
    )


class WorkOrderOperationMinimalForGantt(BaseSchema):
    """工序简要（用于甘特图展示设备/模具/工装，支持工序级派工）"""
    id: Optional[int] = None
    operation_name: Optional[str] = None
    sequence: Optional[int] = None
    work_center_id: Optional[int] = None
    work_center_name: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    assigned_station_id: Optional[int] = None
    assigned_station_name: Optional[str] = None
    assigned_equipment_id: Optional[int] = None
    assigned_equipment_name: Optional[str] = None
    assigned_mold_name: Optional[str] = None
    assigned_tool_name: Optional[str] = None
    assigned_worker_id: Optional[int] = None
    assigned_mold_id: Optional[int] = None
    outsource_kind: Optional[str] = Field("none", description="委外类型 none/planned/ad_hoc")
    outsource_lead_time_days: Optional[int] = None
    default_outsource_supplier_id: Optional[int] = None
    default_outsource_supplier_name: Optional[str] = None
    is_outsourced: Optional[bool] = False


class WorkOrderOperationStepSummary(BaseModel):
    """工序步骤摘要（运营看板 / 列表工序列）"""
    name: str = Field(..., description="工序名称")
    sequence: int = Field(default=0, description="工序序号")
    status: str = Field(..., description="done | active | pending")
    progress: int = Field(default=0, description="进行中工序进度 0-100")


class WorkOrderListResponse(BaseSchema):
    """
    工单列表响应Schema

    用于工单列表API的响应数据格式。
    """
    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
    )

    id: int = Field(..., description="工单ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="工单编码")
    name: Optional[str] = Field(None, description="工单名称（可选）")
    product_name: str = Field(..., description="产品名称")
    product_code: Optional[str] = Field(None, description="产品编码")
    material_spec: Optional[str] = Field(
        None,
        description="产品规格（来自物料主数据 specification，列表展示用）",
    )
    quantity: Decimal = Field(..., description="计划生产数量")
    split_remaining_quantity: Optional[Decimal] = Field(
        None,
        description="拆分剩余可分配数量（已拆分主工单：原数量减去子工单数量之和）",
    )
    production_mode: str = Field(..., description="生产模式")
    sales_order_code: Optional[str] = Field(None, description="销售订单编码")
    sales_order_name: Optional[str] = Field(None, description="销售订单名称（冗余展示）")
    customer_id: Optional[int] = Field(None, description="客户ID（来自关联销售订单）")
    customer_name: Optional[str] = Field(None, description="客户名称（来自关联销售订单）")
    status: str = Field(..., description="工单状态")
    priority: Optional[str] = Field(None, description="优先级")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    completed_quantity: Decimal = Field(default=Decimal("0"), description="已完成数量")
    is_frozen: bool = Field(default=False, description="是否冻结")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    manually_completed: bool = Field(default=False, description="是否指定结束")
    work_center_name: Optional[str] = Field(None, description="工作中心名称")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    readiness_rate: Optional[float] = Field(None, description="齐套率 (%)")
    scheduling_score: Optional[float] = Field(None, description="排程场景综合分")
    scheduling_rank_band: Optional[str] = Field(None, description="排程等级带 A/B/C")
    scheduling_score_breakdown: Optional[dict] = Field(None, description="排程打分明细")
    picking_score: Optional[float] = Field(None, description="备料场景综合分")
    picking_rank_band: Optional[str] = Field(None, description="备料等级带 A/B/C")
    picking_score_breakdown: Optional[dict] = Field(None, description="备料打分明细")
    manufacturing_mode: Optional[str] = Field(
        None,
        description="制造模式（fabrication/assembly）：定义在物料主数据；工单以 product_id 关联所制造的产品物料，从该物料 source_config 解析",
    )
    row_kind: str = Field(
        default="work_order",
        description="列表行类型：work_order（原工单）| split（拆分工单）| rework（返工单）| outsource（工序委外单）",
    )
    parent_work_order_id: Optional[int] = Field(None, description="原工单 ID（子行）")
    children: Optional[List["WorkOrderListResponse"]] = Field(
        None, description="挂在原工单下的拆分工单/返工单/委外单"
    )
    rework_type: Optional[str] = Field(None, description="返工类型（row_kind=rework）")
    rework_operation_names: Optional[str] = Field(
        None, description="返工涉及工序名摘要（row_kind=rework，逗号分隔；空表示整单返工）"
    )
    operation_name: Optional[str] = Field(None, description="委外工序名（row_kind=outsource）")
    supplier_name: Optional[str] = Field(None, description="委外供应商（row_kind=outsource）")
    work_order_group_id: Optional[int] = Field(None, description="所属工单组 ID")
    group_code: Optional[str] = Field(None, description="工单组编码")
    group_name: Optional[str] = Field(None, description="工单组名称")
    group_role: Optional[str] = Field(None, description="组内角色 root/component/outsource_component")
    bom_parent_work_order_id: Optional[int] = Field(None, description="BOM 上级工单 ID")
    supply_mode: Optional[str] = Field(None, description="供应模式 stocked/direct")
    external_sync_at: Optional[datetime] = Field(
        None, description="最近从外部接口/数据集同步时间", serialization_alias="externalSyncAt"
    )
    created_at: datetime = Field(..., description="创建时间")
    operations: Optional[List[WorkOrderOperationMinimalForGantt]] = Field(None, description="工序列表（include_operations=true 时返回）")
    operation_steps: Optional[List[WorkOrderOperationStepSummary]] = Field(
        None,
        description="工序步骤摘要（include_operation_steps=true 时返回，与运营看板口径一致）",
    )
    downstream_push_progress: Optional[float] = Field(
        None,
        description="完工进度 0-100（末道工序已完成数量/工单计划数量，列表用）",
    )
    capabilities: Optional[WorkOrderCapabilities] = Field(
        None, description="业务态动作能力（document_action_policy）"
    )
    base_unit: Optional[str] = Field(None, description="产品基础单位（物料主数据）")
    product_unit: Optional[str] = Field(None, description="生产场景单位（未配置时等于基础单位）")
    unit_to_base_factor: Optional[float] = Field(
        None,
        description="生产单位到基础单位换算因子：1生产单位=factor×1基础单位",
    )
    display_quantity: Optional[Decimal] = Field(
        None, description="计划数量（按生产单位换算后的展示值）"
    )
    display_split_remaining_quantity: Optional[Decimal] = Field(
        None, description="拆分剩余数量（生产单位）"
    )
    display_completed_quantity: Optional[Decimal] = Field(
        None, description="已完成数量（生产单位）"
    )


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


class MaterialLocationInfo(BaseModel):
    """库位详细信息"""
    warehouse_id: int
    warehouse_name: str
    batch_no: Optional[str] = None
    quantity: Decimal
    storage_location_code: Optional[str] = None


class KittingRelatedWorkOrderSummary(BaseModel):
    """齐套分析：BOM 自制/可配置子件对应的组内生产工单"""
    work_order_id: int = Field(..., description="关联工单 ID")
    work_order_code: str = Field(..., description="关联工单编号")
    status: str = Field(..., description="工单状态")
    quantity: Decimal = Field(..., description="计划数量")
    completed_quantity: Decimal = Field(
        default=Decimal("0"),
        description="有效完工数量（方案质检为过程检验放行数，未检完不计）",
    )
    progress_percent: float = Field(
        default=0.0,
        description="有效完工进度 0-100（与 completed_quantity 同口径）",
    )
    planned_end_date: Optional[datetime] = Field(None, description="计划完工/结束时间")


class KittingRelatedOutsourceWorkOrderSummary(BaseModel):
    """齐套分析：BOM 委外子件对应的组内委外工单"""
    outsource_work_order_id: int = Field(..., description="关联委外工单 ID")
    outsource_work_order_code: str = Field(..., description="关联委外工单编号")
    status: str = Field(..., description="委外工单状态")
    quantity: Decimal = Field(..., description="计划委外数量")
    received_quantity: Decimal = Field(default=Decimal("0"), description="合格收货数量（齐套进度展示）")
    progress_percent: float = Field(default=0.0, description="委外完成进度 0-100")
    supplier_name: Optional[str] = Field(None, description="委外供应商名称")
    planned_end_date: Optional[datetime] = Field(None, description="计划完工/结束时间")


class KittingSupplyProgress(BaseModel):
    """
    齐套分析：采购件供给进度（按物料聚合未结采购申请/采购订单）。

    status:
      - stock_covered: 库存/线边已覆盖需求（仍可带关联采购单号）
      - receiving: 采购部分到货、仍有未到货
      - purchasing: 采购中（有未结采购订单）
      - purchase_requisition: 采购申请中（有未转单申请）
      - awaiting_purchase: 待请购（缺料且无下游采购单据）
    """
    status: str = Field(..., description="供给状态码")
    ordered_quantity: Decimal = Field(default=Decimal("0"), description="相关单据订购/申请数量")
    received_quantity: Decimal = Field(default=Decimal("0"), description="已到货数量（采购订单）")
    outstanding_quantity: Decimal = Field(default=Decimal("0"), description="未到货/未转单数量")
    progress_percent: float = Field(default=0.0, description="到货进度 0-100（仅采购订单有意义）")
    document_type: Optional[str] = Field(
        None, description="关联单据类型 purchase_order / purchase_requisition"
    )
    document_id: Optional[int] = Field(None, description="关联单据 ID")
    document_code: Optional[str] = Field(None, description="关联单据编号")
    expected_date: Optional[datetime] = Field(
        None, description="预计完成/交期（采购订单交期或申请要求到货日）"
    )


class MaterialKittingItem(BaseModel):
    """齐套性分析明细项"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    material_unit: Optional[str] = Field(None, description="单位")
    source_type: Optional[str] = Field(None, description="物料来源类型")
    issue_method: Optional[str] = Field(
        None, description="发料方式 pick/backflush/none（解析后）"
    )
    kitting_applicable: bool = Field(
        True, description="是否计入齐套率（服务/虚拟件为 false；委外子件为 true）"
    )
    required_quantity: Decimal = Field(..., description="总需求数量")
    picked_quantity: Decimal = Field(
        ..., description="已正式发料数量（生产领料确认；不含线边备料/补料备料转移）"
    )
    shortage_quantity: Decimal = Field(..., description="缺料数量（相对于总需求）")
    
    # 库存分布
    main_warehouse_available: Decimal = Field(..., description="主仓可用库存（实物，未发料）")
    line_side_available: Decimal = Field(
        ..., description="线边仓可用库存（线边备料/补料备料后；非正式发料）"
    )
    
    # 状态：fully_kitted / partial / shortage / not_applicable（不计入齐套）
    status: str = Field(..., description="齐套状态")
    
    # 具体库位分布
    locations: List[MaterialLocationInfo] = Field(default_factory=list, description="库存位置分布详情")

    # 半成品/可配置件：组内 BOM 子工单
    related_work_order: Optional[KittingRelatedWorkOrderSummary] = Field(
        None, description="关联生产工单（自制/可配置子件）"
    )
    work_order_supply_quantity: Decimal = Field(
        default=Decimal("0"),
        description="自制/可配置关联工单有效完工量（计入线边就绪；委外已收货不计入此字段，须主仓备到线边）",
    )
    related_outsource_work_order: Optional[KittingRelatedOutsourceWorkOrderSummary] = Field(
        None, description="关联委外工单（委外子件）"
    )
    supply_progress: Optional[KittingSupplyProgress] = Field(
        None,
        description="采购供给进度（无关联自制/委外工单时供生产侧查看）",
    )


class WorkOrderKittingAnalysisResponse(BaseModel):
    """工单齐套性分析响应"""
    work_order_id: int
    work_order_code: str
    kitting_rate: Decimal = Field(..., description="齐套率（0-100）")
    status: str = Field(..., description="整体齐套状态")
    items: List[MaterialKittingItem] = Field(..., description="物料齐套明细")


class WorkOrderRemindBatchingRequest(BaseModel):
    """提醒仓库线边备料（站内信）"""
    recipient_user_uuids: List[str] = Field(
        ..., min_length=1, description="提醒对象用户 UUID 列表"
    )
    remarks: Optional[str] = Field(None, max_length=500, description="备注")


class WorkOrderRemindBatchingResponse(BaseModel):
    success: bool = True
    message: str
    notified_count: int = 0
    batching_order_id: Optional[int] = None
    batching_order_code: Optional[str] = None


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


class WorkOrderOperationBase(BaseSchema):
    """工单工序基础Schema"""
    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
    )

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
    assigned_worker_id: Optional[int] = Field(None, description="分配的员工ID（主责/兼容，取 assigned_worker_ids 首项）")
    assigned_worker_name: Optional[str] = Field(None, description="分配的员工姓名（多人以顿号分隔）")
    assigned_worker_ids: List[int] = Field(default_factory=list, description="分配的员工ID列表")
    assigned_team_id: Optional[int] = Field(None, description="分配的工作小组ID")
    assigned_team_name: Optional[str] = Field(None, description="分配的工作小组名称")
    assigned_station_id: Optional[int] = Field(None, description="分配的工位ID")
    assigned_station_name: Optional[str] = Field(None, description="分配的工位名称")
    assigned_equipment_id: Optional[int] = Field(None, description="分配的设备ID")
    assigned_equipment_name: Optional[str] = Field(None, description="分配的设备姓名")
    assigned_mold_id: Optional[int] = Field(None, description="分配的模具ID")
    assigned_mold_name: Optional[str] = Field(None, description="分配的模具名称")
    assigned_tool_id: Optional[int] = Field(None, description="分配的工装ID")
    assigned_tool_name: Optional[str] = Field(None, description="分配的工装名称")
    assigned_at: Optional[datetime] = Field(None, description="分配时间")

    outsource_kind: str = Field("none", description="委外类型：none / planned / ad_hoc")
    outsource_lead_time_days: Optional[int] = Field(None, description="委外提前期（天）")
    default_outsource_supplier_id: Optional[int] = Field(None, description="默认委外供应商ID")
    default_outsource_supplier_name: Optional[str] = Field(None, description="默认委外供应商名称")
    
    remarks: Optional[str] = Field(None, description="备注")


class WorkOrderOperationDispatch(BaseModel):
    """工单工序派工请求Schema"""
    workshop_id: Optional[int] = Field(None, description="车间ID（派工时可调整）")
    workshop_name: Optional[str] = Field(None, max_length=200, description="车间名称")
    work_center_id: Optional[int] = Field(None, description="工作中心ID（派工时可调整）")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    assigned_worker_id: Optional[int] = Field(None, description="分配的员工ID（主责/兼容，取 assigned_worker_ids 首项）")
    assigned_worker_name: Optional[str] = Field(None, description="分配的员工姓名（多人以顿号分隔）")
    assigned_worker_ids: Optional[List[int]] = Field(None, description="分配的员工ID列表")
    assigned_team_id: Optional[int] = Field(None, description="分配的工作小组ID")
    assigned_team_name: Optional[str] = Field(None, description="分配的工作小组名称")
    assigned_station_id: Optional[int] = Field(None, description="分配的工位ID")
    assigned_station_name: Optional[str] = Field(None, description="分配的工位名称")
    assigned_equipment_id: Optional[int] = Field(None, description="分配的设备ID")
    assigned_equipment_name: Optional[str] = Field(None, description="分配的设备姓名")
    assigned_mold_id: Optional[int] = Field(None, description="分配的模具ID")
    assigned_mold_name: Optional[str] = Field(None, description="分配的模具名称")
    assigned_tool_id: Optional[int] = Field(None, description="分配的工装ID")
    assigned_tool_name: Optional[str] = Field(None, description="分配的工装名称")
    remarks: Optional[str] = Field(None, description="派工备注")


class WorkOrderOperationCreate(WorkOrderOperationBase):
    """创建工单工序Schema（开单时可覆盖报工类型、节点工序等；跳转由工单级控制）"""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: Optional[int] = Field(None, description="工单工序ID（编辑清单时传入以更新既有行；新增行不传）")
    reporting_type: Optional[str] = Field(None, alias="reportingType", description="报工类型（未传则用工序档案）")
    allow_jump: Optional[bool] = Field(
        None,
        alias="allowJump",
        description="已废弃：不参与校验，服务端恒按 False 落库",
    )
    is_node_operation: Optional[bool] = Field(
        None,
        alias="isNodeOperation",
        description="是否节点工序（仅开单/路线序列传入；未传则为 False）",
    )
    over_report_mode: Optional[str] = Field(None, alias="overReportMode", description="超报模式（未传则按继承链合并）")
    over_report_value: Optional[Decimal] = Field(None, alias="overReportValue", description="超报值")


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


class DefectTypeMinimal(BaseModel):
    """不良品项简要（工序绑定用）"""
    uuid: str = Field(..., description="不良品UUID")
    code: str = Field(..., description="不良品编码")
    name: str = Field(..., description="不良品名称")


class WorkOrderOperationResponse(WorkOrderOperationBase):
    """工单工序响应Schema"""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

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
    
    # 工序关联的不良品项（从 master_data 获取）
    defect_types: List[DefectTypeMinimal] = Field(default_factory=list, description="工序关联的不良品类型")
    
    # 物料汇总（工序卡片人机料法用，后端按需填充）
    material_picked_count: Optional[int] = Field(None, description="已领料物料种类数（首道工序）")
    material_remaining: Optional[Decimal] = Field(None, description="当前工序剩余数量")
    material_scrap_qty: Optional[Decimal] = Field(None, description="本道工序报废数量")
    next_op_planned_qty: Optional[Decimal] = Field(None, description="下道工序计划/实际数量（本道产出）")
    next_op_has_reporting: Optional[bool] = Field(None, description="下道是否已报工（虚线/实线）")
    assembly_kit_sets: Optional[int] = Field(None, description="可装配套数（组合型首道工序，可选）")
    sop_id: Optional[int] = Field(None, description="关联SOP ID（法）")
    sop_uuid: Optional[str] = Field(None, description="关联SOP UUID（用于跳转查看）")
    sop_name: Optional[str] = Field(None, description="关联SOP 名称")

    reporting_type: str = Field("quantity", description="报工类型（quantity/status）")
    allow_jump: bool = Field(False, description="已废弃：不参与跳转判断，恒为 False（新数据）")
    is_node_operation: bool = Field(False, description="是否节点工序（允许跳转时前序节点仍不可跳过）")
    default_operators: List[DefaultOperatorSnapshot] = Field(
        default_factory=list,
        description="工序档案配置的默认生产人员（报工默认与下拉标记）",
    )
    over_report_mode: str = Field("none", alias="overReportMode", description="超报模式（none/fixed/percent）")
    over_report_value: Decimal = Field(Decimal("0"), alias="overReportValue", description="超报值")
    max_reportable_quantity: Decimal = Field(
        ...,
        alias="maxReportableQuantity",
        description="本道工序允许的最大累计完成数量（含超报，相对当前工单计划数量计算）",
    )
    is_outsourced: bool = Field(
        False,
        description="是否委外（计划委外/临时委外或存在未取消委外单）",
    )
    outsource_supplier_name: Optional[str] = Field(None, description="委外供应商名称")
    outsource_order_code: Optional[str] = Field(None, description="委外单编码")

    # 质检（工序档案 IPQC 策略，后端按需填充）
    inspection_mode: str = Field("none", alias="inspectionMode", description="质检模式（none/simple/plan）")
    inspection_plan_label: Optional[str] = Field(
        None, alias="inspectionPlanLabel", description="方案质检时的检验方案名称"
    )
    transfer_qualified_quantity: Optional[Decimal] = Field(
        None,
        alias="transferQualifiedQuantity",
        description="可转下道合格数量（方案质检须过程检验放行后计入）",
    )
    qc_pending_quantity: Optional[Decimal] = Field(
        None, alias="qcPendingQuantity", description="方案质检下已报工未放行的数量"
    )
    process_inspection_pending_count: Optional[int] = Field(
        None, alias="processInspectionPendingCount", description="待检验过程检验单数量"
    )
    process_inspection_pending_codes: List[str] = Field(
        default_factory=list,
        alias="processInspectionPendingCodes",
        description="待检验过程检验单编码（展示用）",
    )
    process_inspection_status: Optional[str] = Field(
        None,
        alias="processInspectionStatus",
        description="方案质检过程检验执行态（not_started/pending/inspected）",
    )
    process_inspection_id: Optional[int] = Field(
        None,
        alias="processInspectionId",
        description="工序关联过程检验单ID（卡片徽章跳转）",
    )
    inspection_qualified_quantity: Optional[Decimal] = Field(
        None,
        alias="inspectionQualifiedQuantity",
        description="方案质检：已执行过程检验单合格数量合计（卡片合格率口径）",
    )
    inspection_unqualified_quantity: Optional[Decimal] = Field(
        None,
        alias="inspectionUnqualifiedQuantity",
        description="方案质检：已执行过程检验单不合格数量合计（卡片合格率口径）",
    )
    
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


class WorkOrderSchedulingQuickActionRequest(BaseModel):
    """可视排产快捷处置请求"""

    work_order_ids: list[int] = Field(..., min_length=1, max_length=50, description="工单ID列表")
    action: str = Field(
        ...,
        description="快捷处置动作（confirm_delay/to_exception/apply_unfreeze/reschedule_forward）",
    )
    reason: Optional[str] = Field(None, description="处置原因")
    auto_move_out_of_freeze_window: bool = Field(
        True,
        description="是否自动顺延到冻结窗外（仅对延期确认/解冻申请生效）",
    )


class WorkOrderSchedulingQuickActionResult(BaseModel):
    """可视排产快捷处置结果"""

    updated: list[int] = Field(default_factory=list, description="已更新工单")
    converted_to_exception: list[int] = Field(default_factory=list, description="已转异常工单")
    unfreezed: list[int] = Field(default_factory=list, description="已解冻工单")
    skipped: list[int] = Field(default_factory=list, description="跳过工单")
    failed: list[dict] = Field(default_factory=list, description="失败明细")


class WorkOrderMergeRequest(BaseModel):
    """工单合并请求Schema"""
    work_order_ids: list[int] = Field(..., min_length=2, description="要合并的工单ID列表（至少2个）")
    remarks: Optional[str] = Field(None, description="合并备注")


class WorkOrderMergeResponse(BaseModel):
    """工单合并响应Schema"""
    merged_work_order: WorkOrderResponse = Field(..., description="合并后的工单")
    original_work_order_ids: list[int] = Field(..., description="原工单ID列表")
    original_work_order_codes: list[str] = Field(..., description="原工单编码列表")


class WorkOrderMergeIntoGroupRequest(BaseModel):
    """将多张工单编入同一工单组（不取消原工单）"""
    work_order_ids: list[int] = Field(..., min_length=2, description="工单 ID 列表（至少 2 个）")
    root_work_order_id: Optional[int] = Field(
        None,
        description="组成品工单 ID（可选）；不传则仅虚拟编组，成员在组下平级展示",
    )
    remarks: Optional[str] = Field(None, description="工单组名称（可选；未填则使用默认名称）")


class WorkOrderMergeIntoGroupResponse(BaseModel):
    """编入工单组结果"""
    work_order_group_id: int = Field(..., description="工单组 ID")
    group_code: str = Field(..., description="工单组编码")
    work_order_ids: list[int] = Field(..., description="已编入的工单 ID")
    work_order_codes: list[str] = Field(..., description="已编入的工单编码")


class WorkOrderDissolveGroupRequest(BaseModel):
    """解除编组（工单保留）"""
    work_order_group_ids: list[int] = Field(
        ...,
        min_length=1,
        description="工单组 ID 列表",
    )


class WorkOrderDissolveGroupItem(BaseModel):
    """单个工单组解除编组结果"""
    work_order_group_id: int = Field(..., description="工单组 ID")
    group_code: str = Field(..., description="工单组编码")
    group_name: Optional[str] = Field(None, description="工单组名称")
    work_order_count: int = Field(..., description="解除关联的生产工单数")
    outsource_count: int = Field(..., description="解除关联的委外工单数")


class WorkOrderDissolveGroupResponse(BaseModel):
    """解除编组结果"""
    groups: list[WorkOrderDissolveGroupItem] = Field(..., description="已解除编组的工单组")


class PeerGroupWorkOrderItemCreate(BaseModel):
    """平级组工单明细行"""
    product_id: int = Field(..., description="产品物料 ID")
    quantity: Decimal = Field(..., gt=0, description="计划数量")
    priority: str = Field("normal", description="优先级")
    process_route_id: Optional[int] = Field(
        None, alias="processRouteId", description="工艺路线 ID（可选；未选则按产品自动匹配）"
    )
    allow_operation_jump: Optional[bool] = Field(
        None, description="是否允许跳转工序；不传则随工艺路线"
    )
    over_report_mode: str = Field("none", description="工单默认超报模式")
    over_report_value: Decimal = Field(Decimal("0"), description="工单默认超报数值")


class WorkOrderCreatePeerGroupRequest(BaseModel):
    """新建平级组工单（批量创建工单并编入同一虚拟组）"""
    group_name: Optional[str] = Field(None, description="工单组名称（可选）")
    production_mode: str = Field("MTS", description="生产模式（MTS/MTO）")
    sales_order_id: Optional[int] = Field(None, description="销售订单 ID（MTO）")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始（应用于各成员）")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束（应用于各成员）")
    items: list[PeerGroupWorkOrderItemCreate] = Field(
        ...,
        min_length=2,
        description="组内工单明细（至少 2 行）",
    )


class WorkOrderCreatePeerGroupResponse(BaseModel):
    """新建平级组工单结果"""
    work_order_group_id: int = Field(..., description="工单组 ID")
    group_code: str = Field(..., description="工单组编码")
    work_order_ids: list[int] = Field(..., description="已创建的工单 ID")
    work_order_codes: list[str] = Field(..., description="已创建的工单编码")


class WorkOrderTrackingPreviewRequest(BaseModel):
    """批号/序列号预览请求"""
    product_id: int = Field(..., description="产品物料 ID")
    quantity: Decimal = Field(..., gt=0, description="计划数量")
    batch_rule_id: Optional[int] = Field(None, description="批号规则 ID")
    serial_rule_id: Optional[int] = Field(None, description="序列号规则 ID")


class WorkOrderTrackingPreviewResponse(BaseModel):
    """批号/序列号预览响应"""
    tracking_mode: str = Field(..., description="追踪模式")
    planned_batch_no: Optional[str] = Field(None, description="预览批号")
    planned_serial_nos: List[str] = Field(default_factory=list, description="预览序列号列表")


class WorkOrderConfirmTrackingRequest(BaseModel):
    """完工确认批号/序列号"""
    confirmed_batch_no: Optional[str] = Field(None, description="确认批号（不传则沿用计划或按规则生成）")
    confirmed_serial_no: Optional[str] = Field(None, description="确认序列号（不传则沿用计划或按规则生成）")


class WorkOrderCompleteRequest(BaseModel):
    """指定结束工单（可附带追踪确认）"""
    confirmed_batch_no: Optional[str] = Field(None, description="确认批号")
    confirmed_serial_no: Optional[str] = Field(None, description="确认序列号")


# 更新前向引用（Pydantic v2 需要）
WorkOrderCreate.model_rebuild()
WorkOrderListResponse.model_rebuild()
