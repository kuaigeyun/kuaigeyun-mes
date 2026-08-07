"""
售后服务模块 Schema

装机档案、维修单、服务派工、备件申领、服务结算、客户回访、看板统计。
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


# --- 装机档案 ---

SERVICE_ASSET_STATUSES = ("在用", "停用", "报废")


class ServiceAssetCreate(BaseSchema):
    customer_id: int = Field(..., description="客户ID")
    material_id: Optional[int] = Field(None, description="产品物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="产品编码")
    material_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="规格型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    sales_order_id: Optional[int] = Field(None, description="来源销售订单ID")
    sales_delivery_id: Optional[int] = Field(None, description="来源销售出库单ID")
    install_execution_id: Optional[int] = Field(None, description="来源安装执行单ID")
    install_address: Optional[str] = Field(None, max_length=500, description="安装地址")
    accepted_at: Optional[datetime] = Field(None, description="验收日期")
    warranty_start_at: Optional[datetime] = Field(None, description="保修起始")
    warranty_end_at: Optional[datetime] = Field(None, description="保修截止")
    warranty_months: Optional[int] = Field(None, description="保修月数")
    warranty_policy: Optional[str] = Field(None, max_length=100, description="保修策略")
    status: Optional[str] = Field("在用", max_length=20, description="状态")
    notes: Optional[str] = Field(None, description="备注")


class ServiceAssetUpdate(BaseSchema):
    material_id: Optional[int] = Field(None, description="产品物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="产品编码")
    material_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="规格型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    install_address: Optional[str] = Field(None, max_length=500, description="安装地址")
    accepted_at: Optional[datetime] = Field(None, description="验收日期")
    warranty_start_at: Optional[datetime] = Field(None, description="保修起始")
    warranty_end_at: Optional[datetime] = Field(None, description="保修截止")
    warranty_months: Optional[int] = Field(None, description="保修月数")
    warranty_policy: Optional[str] = Field(None, max_length=100, description="保修策略")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    notes: Optional[str] = Field(None, description="备注")


class ServiceAssetResponse(BaseSchema):
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    asset_code: str = Field(..., description="资产编码")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    material_id: Optional[int] = Field(None, description="产品物料ID")
    material_code: Optional[str] = Field(None, description="产品编码")
    material_name: Optional[str] = Field(None, description="产品名称")
    material_spec: Optional[str] = Field(None, description="规格型号")
    serial_number: Optional[str] = Field(None, description="序列号")
    sales_order_id: Optional[int] = Field(None, description="来源销售订单ID")
    sales_order_code: Optional[str] = Field(None, description="来源销售订单编码")
    sales_delivery_id: Optional[int] = Field(None, description="来源销售出库单ID")
    sales_delivery_code: Optional[str] = Field(None, description="来源销售出库单编码")
    install_execution_id: Optional[int] = Field(None, description="来源安装执行单ID")
    install_execution_code: Optional[str] = Field(None, description="来源安装执行单编码")
    install_address: Optional[str] = Field(None, description="安装地址")
    accepted_at: Optional[datetime] = Field(None, description="验收日期")
    warranty_start_at: Optional[datetime] = Field(None, description="保修起始")
    warranty_end_at: Optional[datetime] = Field(None, description="保修截止")
    warranty_months: Optional[int] = Field(None, description="保修月数")
    warranty_policy: Optional[str] = Field(None, description="保修策略")
    status: str = Field(..., description="状态")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")
    updated_by_name: Optional[str] = Field(None, description="更新人显示名")


class ServiceAssetListEnvelope(BaseSchema):
    items: List[ServiceAssetResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")


# --- 维修单 ---

REPAIR_MODES = ("现场", "返厂")
WARRANTY_STATUSES = ("保内", "保外", "待判定")
REPAIR_ORDER_STATUSES = ("待派工", "维修中", "待验收", "已关闭")


class RepairOrderItemCreate(BaseSchema):
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="单位")
    quantity: Optional[Decimal] = Field(None, description="数量")
    unit_price: Optional[Decimal] = Field(None, description="单价")
    amount: Optional[Decimal] = Field(None, description="金额")
    notes: Optional[str] = Field(None, description="备注")


class RepairOrderItemResponse(RepairOrderItemCreate):
    id: int = Field(..., description="明细ID")
    repair_order_id: int = Field(..., description="维修单ID")
    line_no: int = Field(..., description="行号")


class RepairOrderCreate(BaseSchema):
    customer_id: int = Field(..., description="客户ID")
    after_sales_ticket_id: Optional[int] = Field(None, description="来源售后工单ID")
    service_asset_id: Optional[int] = Field(None, description="装机档案ID")
    repair_mode: Optional[str] = Field("现场", max_length=20, description="维修方式")
    fault_category: Optional[str] = Field(None, max_length=100, description="故障分类")
    fault_description: str = Field(..., description="故障描述")
    site_address: Optional[str] = Field(None, max_length=500, description="现场地址")
    reported_at: Optional[datetime] = Field(None, description="报修时间")
    notes: Optional[str] = Field(None, description="备注")
    items: List[RepairOrderItemCreate] = Field(default_factory=list, description="备件明细")


class RepairOrderUpdate(BaseSchema):
    repair_mode: Optional[str] = Field(None, max_length=20, description="维修方式")
    fault_category: Optional[str] = Field(None, max_length=100, description="故障分类")
    fault_description: Optional[str] = Field(None, description="故障描述")
    diagnosis_result: Optional[str] = Field(None, description="诊断结果")
    resolution: Optional[str] = Field(None, description="处理结果")
    warranty_status: Optional[str] = Field(None, max_length=20, description="保内保外")
    warranty_override_reason: Optional[str] = Field(None, description="改判原因")
    labor_cost: Optional[Decimal] = Field(None, description="人工费")
    travel_cost: Optional[Decimal] = Field(None, description="差旅费")
    spare_part_cost: Optional[Decimal] = Field(None, description="备件费")
    outsource_cost: Optional[Decimal] = Field(None, description="外协费")
    site_address: Optional[str] = Field(None, max_length=500, description="现场地址")
    notes: Optional[str] = Field(None, description="备注")
    items: Optional[List[RepairOrderItemCreate]] = Field(None, description="备件明细（传入则整表替换）")


class RepairOrderClose(BaseSchema):
    resolution: Optional[str] = Field(None, description="处理结果")
    diagnosis_result: Optional[str] = Field(None, description="诊断结果")


class RepairOrderResponse(BaseSchema):
    id: int = Field(..., description="维修单ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    order_code: str = Field(..., description="维修单号")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    after_sales_ticket_id: Optional[int] = Field(None, description="来源售后工单ID")
    after_sales_ticket_code: Optional[str] = Field(None, description="来源售后工单编码")
    service_asset_id: Optional[int] = Field(None, description="装机档案ID")
    service_asset_code: Optional[str] = Field(None, description="装机档案编码")
    repair_mode: str = Field(..., description="维修方式")
    fault_category: Optional[str] = Field(None, description="故障分类")
    fault_description: str = Field(..., description="故障描述")
    diagnosis_result: Optional[str] = Field(None, description="诊断结果")
    resolution: Optional[str] = Field(None, description="处理结果")
    warranty_status: str = Field(..., description="保内保外")
    warranty_override_reason: Optional[str] = Field(None, description="改判原因")
    labor_cost: Optional[Decimal] = Field(None, description="人工费")
    travel_cost: Optional[Decimal] = Field(None, description="差旅费")
    spare_part_cost: Optional[Decimal] = Field(None, description="备件费")
    outsource_cost: Optional[Decimal] = Field(None, description="外协费")
    total_cost: Optional[Decimal] = Field(None, description="费用合计")
    status: str = Field(..., description="状态")
    site_address: Optional[str] = Field(None, description="现场地址")
    reported_at: datetime = Field(..., description="报修时间")
    closed_at: Optional[datetime] = Field(None, description="关闭时间")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")
    updated_by_name: Optional[str] = Field(None, description="更新人显示名")
    items: List[RepairOrderItemResponse] = Field(default_factory=list, description="备件明细")


class RepairOrderListEnvelope(BaseSchema):
    items: List[RepairOrderResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")


# --- 服务派工 ---

DISPATCH_SOURCE_TYPES = ("install_execution", "repair_order")
DISPATCH_STATUSES = ("待接单", "已接单", "到场", "完工", "已取消")


class ServiceDispatchCreate(BaseSchema):
    customer_id: int = Field(..., description="客户ID")
    source_type: str = Field(..., max_length=30, description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    engineer_id: Optional[int] = Field(None, description="工程师用户ID")
    engineer_name: Optional[str] = Field(None, max_length=100, description="工程师姓名")
    planned_start_at: Optional[datetime] = Field(None, description="计划开始")
    planned_end_at: Optional[datetime] = Field(None, description="计划结束")
    site_address: Optional[str] = Field(None, max_length=500, description="服务地址")
    notes: Optional[str] = Field(None, description="备注")


class ServiceDispatchUpdate(BaseSchema):
    engineer_id: Optional[int] = Field(None, description="工程师用户ID")
    engineer_name: Optional[str] = Field(None, max_length=100, description="工程师姓名")
    planned_start_at: Optional[datetime] = Field(None, description="计划开始")
    planned_end_at: Optional[datetime] = Field(None, description="计划结束")
    site_address: Optional[str] = Field(None, max_length=500, description="服务地址")
    notes: Optional[str] = Field(None, description="备注")


class ServiceDispatchAssign(BaseSchema):
    engineer_id: int = Field(..., description="工程师用户ID")
    engineer_name: Optional[str] = Field(None, max_length=100, description="工程师姓名")
    planned_start_at: Optional[datetime] = Field(None, description="计划开始")
    planned_end_at: Optional[datetime] = Field(None, description="计划结束")


class ServiceDispatchCheckin(BaseSchema):
    checkin_location: Optional[str] = Field(None, max_length=200, description="签到地点")
    checkin_at: Optional[datetime] = Field(None, description="签到时间")


class ServiceDispatchComplete(BaseSchema):
    completion_notes: Optional[str] = Field(None, description="完工说明")
    attachments: Optional[List[Dict[str, Any]]] = Field(None, description="现场照片附件")
    actual_end_at: Optional[datetime] = Field(None, description="实际结束时间")


class ServiceDispatchCancel(BaseSchema):
    notes: Optional[str] = Field(None, description="取消说明")


class ServiceDispatchResponse(BaseSchema):
    id: int = Field(..., description="派工单ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    dispatch_code: str = Field(..., description="派工单号")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    source_type: str = Field(..., description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., description="来源单据编码")
    engineer_id: Optional[int] = Field(None, description="工程师用户ID")
    engineer_name: Optional[str] = Field(None, description="工程师姓名")
    planned_start_at: Optional[datetime] = Field(None, description="计划开始")
    planned_end_at: Optional[datetime] = Field(None, description="计划结束")
    actual_start_at: Optional[datetime] = Field(None, description="实际开始")
    actual_end_at: Optional[datetime] = Field(None, description="实际结束")
    site_address: Optional[str] = Field(None, description="服务地址")
    status: str = Field(..., description="状态")
    checkin_at: Optional[datetime] = Field(None, description="到场签到时间")
    checkin_location: Optional[str] = Field(None, description="签到地点")
    completion_notes: Optional[str] = Field(None, description="完工说明")
    attachments: Optional[List[Dict[str, Any]]] = Field(None, description="现场照片附件")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")
    updated_by_name: Optional[str] = Field(None, description="更新人显示名")


class ServiceDispatchListEnvelope(BaseSchema):
    items: List[ServiceDispatchResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")


# --- 售后备件申领 ---

REQUISITION_SOURCE_TYPES = ("repair_order", "install_execution")
REQUISITION_STATUSES = ("草稿", "待审核", "已审核", "已驳回")


class AfterSalesSparePartRequisitionItemCreate(BaseSchema):
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="单位")
    quantity: Optional[Decimal] = Field(None, description="数量")
    notes: Optional[str] = Field(None, description="备注")


class AfterSalesSparePartRequisitionItemResponse(AfterSalesSparePartRequisitionItemCreate):
    id: int = Field(..., description="明细ID")
    requisition_id: int = Field(..., description="申领单ID")
    line_no: int = Field(..., description="行号")


class AfterSalesSparePartRequisitionCreate(BaseSchema):
    source_type: str = Field(..., max_length=30, description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID")
    warehouse_name: Optional[str] = Field(None, max_length=100, description="出库仓库名称")
    notes: Optional[str] = Field(None, description="备注")
    items: List[AfterSalesSparePartRequisitionItemCreate] = Field(
        default_factory=list, description="申领明细"
    )


class AfterSalesSparePartRequisitionUpdate(BaseSchema):
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID")
    warehouse_name: Optional[str] = Field(None, max_length=100, description="出库仓库名称")
    notes: Optional[str] = Field(None, description="备注")
    items: Optional[List[AfterSalesSparePartRequisitionItemCreate]] = Field(
        None, description="申领明细（传入则整表替换）"
    )


class AfterSalesSparePartRequisitionAudit(BaseSchema):
    review_remarks: Optional[str] = Field(None, description="审核备注")


class AfterSalesSparePartRequisitionReject(BaseSchema):
    review_remarks: str = Field(..., description="驳回原因")


class AfterSalesSparePartRequisitionResponse(BaseSchema):
    id: int = Field(..., description="申领单ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    requisition_code: str = Field(..., description="申领单号")
    source_type: str = Field(..., description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., description="来源单据编码")
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID")
    warehouse_name: Optional[str] = Field(None, description="出库仓库名称")
    other_outbound_id: Optional[int] = Field(None, description="关联其他出库单ID")
    other_outbound_code: Optional[str] = Field(None, description="关联其他出库单编码")
    status: str = Field(..., description="状态")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, description="审核人姓名")
    reviewed_at: Optional[datetime] = Field(None, description="审核时间")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")
    updated_by_name: Optional[str] = Field(None, description="更新人显示名")
    items: List[AfterSalesSparePartRequisitionItemResponse] = Field(
        default_factory=list, description="申领明细"
    )


class AfterSalesSparePartRequisitionListEnvelope(BaseSchema):
    items: List[AfterSalesSparePartRequisitionResponse] = Field(
        default_factory=list, description="当前页数据"
    )
    total: int = Field(0, description="总条数")


# --- 服务结算 ---

SETTLEMENT_SOURCE_TYPES = ("repair_order", "install_execution")
SETTLEMENT_STATUSES = ("草稿", "待审核", "已审核")


class ServiceSettlementItemCreate(BaseSchema):
    source_type: str = Field(..., max_length=30, description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: Optional[str] = Field(None, max_length=50, description="来源单据编码")
    warranty_status: Optional[str] = Field(None, max_length=20, description="保内保外")
    amount: Optional[Decimal] = Field(None, description="金额")
    notes: Optional[str] = Field(None, description="备注")


class ServiceSettlementItemResponse(ServiceSettlementItemCreate):
    id: int = Field(..., description="明细ID")
    settlement_id: int = Field(..., description="结算单ID")
    line_no: int = Field(..., description="行号")


class ServiceSettlementCreate(BaseSchema):
    customer_id: int = Field(..., description="客户ID")
    notes: Optional[str] = Field(None, description="备注")
    items: List[ServiceSettlementItemCreate] = Field(default_factory=list, description="结算明细")


class ServiceSettlementUpdate(BaseSchema):
    notes: Optional[str] = Field(None, description="备注")
    items: Optional[List[ServiceSettlementItemCreate]] = Field(
        None, description="结算明细（传入则整表替换）"
    )


class ServiceSettlementAudit(BaseSchema):
    review_remarks: Optional[str] = Field(None, description="审核备注")


class ServiceSettlementReject(BaseSchema):
    review_remarks: str = Field(..., description="驳回原因")


class ServiceSettlementResponse(BaseSchema):
    id: int = Field(..., description="结算单ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    settlement_code: str = Field(..., description="结算单号")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    warranty_free_amount: Decimal = Field(..., description="保内免收")
    chargeable_amount: Decimal = Field(..., description="保外应收")
    total_amount: Decimal = Field(..., description="合计金额")
    status: str = Field(..., description="状态")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, description="审核人姓名")
    reviewed_at: Optional[datetime] = Field(None, description="审核时间")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")
    updated_by_name: Optional[str] = Field(None, description="更新人显示名")
    items: List[ServiceSettlementItemResponse] = Field(default_factory=list, description="结算明细")


class ServiceSettlementListEnvelope(BaseSchema):
    items: List[ServiceSettlementResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")


# --- 客户回访 ---

VISIT_SOURCE_TYPES = ("after_sales_ticket", "repair_order")
VISIT_METHODS = ("电话", "现场", "在线", "其他")


class CustomerReturnVisitCreate(BaseSchema):
    customer_id: int = Field(..., description="客户ID")
    source_type: str = Field(..., max_length=30, description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    visit_method: Optional[str] = Field("电话", max_length=30, description="回访方式")
    satisfaction_score: Optional[int] = Field(None, ge=1, le=5, description="满意度评分1-5")
    feedback: Optional[str] = Field(None, description="客户反馈")
    visitor_id: Optional[int] = Field(None, description="回访人ID")
    visitor_name: Optional[str] = Field(None, max_length=100, description="回访人姓名")
    visited_at: Optional[datetime] = Field(None, description="回访时间")
    notes: Optional[str] = Field(None, description="备注")


class CustomerReturnVisitUpdate(BaseSchema):
    visit_method: Optional[str] = Field(None, max_length=30, description="回访方式")
    satisfaction_score: Optional[int] = Field(None, ge=1, le=5, description="满意度评分1-5")
    feedback: Optional[str] = Field(None, description="客户反馈")
    visitor_id: Optional[int] = Field(None, description="回访人ID")
    visitor_name: Optional[str] = Field(None, max_length=100, description="回访人姓名")
    visited_at: Optional[datetime] = Field(None, description="回访时间")
    notes: Optional[str] = Field(None, description="备注")


class CustomerReturnVisitResponse(BaseSchema):
    id: int = Field(..., description="回访单ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    visit_code: str = Field(..., description="回访单号")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    source_type: str = Field(..., description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., description="来源单据编码")
    visit_method: str = Field(..., description="回访方式")
    satisfaction_score: Optional[int] = Field(None, description="满意度评分")
    feedback: Optional[str] = Field(None, description="客户反馈")
    visitor_id: Optional[int] = Field(None, description="回访人ID")
    visitor_name: Optional[str] = Field(None, description="回访人姓名")
    visited_at: datetime = Field(..., description="回访时间")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")
    updated_by_name: Optional[str] = Field(None, description="更新人显示名")


class CustomerReturnVisitListEnvelope(BaseSchema):
    items: List[CustomerReturnVisitResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")


# --- 看板 ---

class AfterSalesDashboardResponse(BaseSchema):
    ticket_count: int = Field(0, description="售后工单数")
    open_ticket_count: int = Field(0, description="未关闭工单数")
    repair_order_count: int = Field(0, description="维修单数")
    open_repair_order_count: int = Field(0, description="未关闭维修单数")
    dispatch_total: int = Field(0, description="派工单总数（不含已取消）")
    dispatch_completed: int = Field(0, description="已完工派工单数")
    dispatch_completion_rate: Optional[Decimal] = Field(None, description="派工完成率")
    return_visit_count: int = Field(0, description="回访记录数")
    average_satisfaction: Optional[Decimal] = Field(None, description="平均满意度")
    service_asset_count: int = Field(0, description="装机档案数")
