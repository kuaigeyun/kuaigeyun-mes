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
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

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


class WorkOrderBatchUpdateDatesItem(BaseModel):
    """批量更新工单计划日期项"""
    work_order_id: int = Field(..., description="工单ID")
    planned_start_date: datetime = Field(..., description="计划开始时间")
    planned_end_date: datetime = Field(..., description="计划结束时间")


class WorkOrderBatchUpdateDatesRequest(BaseModel):
    """批量更新工单计划日期请求"""
    updates: list[WorkOrderBatchUpdateDatesItem] = Field(..., description="更新项列表")


class WorkOrderOperationBatchUpdateDatesItem(BaseModel):
    """批量更新工序计划日期项"""
    operation_id: int = Field(..., description="工序ID（WorkOrderOperation.id）")
    planned_start_date: datetime = Field(..., description="计划开始时间")
    planned_end_date: datetime = Field(..., description="计划结束时间")


class WorkOrderOperationBatchUpdateDatesRequest(BaseModel):
    """批量更新工序计划日期请求（工序级派工）"""
    updates: list[WorkOrderOperationBatchUpdateDatesItem] = Field(..., description="更新项列表")


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
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    manufacturing_mode: Optional[str] = Field(None, description="制造模式（fabrication加工型/assembly装配型，来自产品物料的 source_config）")


class WorkOrderOperationMinimalForGantt(BaseModel):
    """工序简要（用于甘特图展示设备/模具/工装，支持工序级派工）"""
    id: Optional[int] = None
    operation_name: Optional[str] = None
    sequence: Optional[int] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    assigned_equipment_name: Optional[str] = None
    assigned_mold_name: Optional[str] = None
    assigned_tool_name: Optional[str] = None


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
    readiness_rate: Optional[float] = Field(None, description="齐套率 (%)")
    created_at: datetime = Field(..., description="创建时间")
    operations: Optional[List[WorkOrderOperationMinimalForGantt]] = Field(None, description="工序列表（include_operations=true 时返回）")


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


class MaterialKittingItem(BaseModel):
    """齐套性分析明细项"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    material_unit: Optional[str] = Field(None, description="单位")
    required_quantity: Decimal = Field(..., description="总需求数量")
    picked_quantity: Decimal = Field(..., description="已领料数量")
    shortage_quantity: Decimal = Field(..., description="缺料数量（相对于总需求）")
    
    # 库存分布
    main_warehouse_available: Decimal = Field(..., description="主仓可用库存")
    line_side_available: Decimal = Field(..., description="线边仓可用库存")
    
    # 状态：fully_kitted(全齐), partial(部分满足), shortage(短缺)
    status: str = Field(..., description="齐套状态")
    
    # 具体库位分布
    locations: List[MaterialLocationInfo] = Field(default_factory=list, description="库存位置分布详情")


class WorkOrderKittingAnalysisResponse(BaseModel):
    """工单齐套性分析响应"""
    work_order_id: int
    work_order_code: str
    kitting_rate: Decimal = Field(..., description="齐套率（0-100）")
    status: str = Field(..., description="整体齐套状态")
    items: List[MaterialKittingItem] = Field(..., description="物料齐套明细")


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
    assigned_mold_id: Optional[int] = Field(None, description="分配的模具ID")
    assigned_mold_name: Optional[str] = Field(None, description="分配的模具名称")
    assigned_tool_id: Optional[int] = Field(None, description="分配的工装ID")
    assigned_tool_name: Optional[str] = Field(None, description="分配的工装名称")
    assigned_at: Optional[datetime] = Field(None, description="分配时间")
    
    remarks: Optional[str] = Field(None, description="备注")


class WorkOrderOperationDispatch(BaseModel):
    """工单工序派工请求Schema"""
    assigned_worker_id: Optional[int] = Field(None, description="分配的员工ID")
    assigned_worker_name: Optional[str] = Field(None, description="分配的员工姓名")
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
    assembly_kit_sets: Optional[int] = Field(None, description="可装配套数（装配型首道工序，可选）")
    sop_id: Optional[int] = Field(None, description="关联SOP ID（法）")
    sop_uuid: Optional[str] = Field(None, description="关联SOP UUID（用于跳转查看）")
    sop_name: Optional[str] = Field(None, description="关联SOP 名称")

    reporting_type: str = Field("quantity", description="报工类型（quantity/status）")
    allow_jump: bool = Field(False, description="已废弃：不参与跳转判断，恒为 False（新数据）")
    is_node_operation: bool = Field(False, description="是否节点工序（允许跳转时前序节点仍不可跳过）")
    over_report_mode: str = Field("none", alias="overReportMode", description="超报模式（none/fixed/percent）")
    over_report_value: Decimal = Field(Decimal("0"), alias="overReportValue", description="超报值")
    max_reportable_quantity: Decimal = Field(
        ...,
        alias="maxReportableQuantity",
        description="本道工序允许的最大累计完成数量（含超报，相对当前工单计划数量计算）",
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
