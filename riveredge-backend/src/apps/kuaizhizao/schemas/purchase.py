"""
采购订单数据验证Schema

提供采购订单相关的Pydantic数据验证模型。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import date, datetime
from typing import List, Optional
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict, field_validator
from apps.kuaizhizao.services.document_action_policy.types import PurchaseOrderCapabilities

from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus

# 导入BaseSchema用于兼容性
from core.schemas.base import BaseSchema


# === 采购订单 ===
class PurchaseOrderBase(BaseSchema):
    """采购订单基础Schema"""
    model_config = ConfigDict(from_attributes=True)

    order_code: Optional[str] = Field(None, max_length=50, description="订单编码")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    supplier_contact: Optional[str] = Field(None, max_length=100, description="供应商联系人")
    supplier_phone: Optional[str] = Field(None, max_length=20, description="供应商电话")
    buyer_id: Optional[int] = Field(None, description="归属采购员ID")
    buyer_name: Optional[str] = Field(None, max_length=100, description="归属采购员姓名")
    order_date: date = Field(..., description="订单日期")
    delivery_date: date = Field(..., description="要求到货日期")
    order_type: str = Field("标准采购", max_length=20, description="订单类型")
    total_quantity: Decimal = Field(default=Decimal(0), ge=0, description="总数量")
    total_amount: Decimal = Field(default=Decimal(0), ge=0, description="订单总金额")
    tax_rate: Decimal = Field(default=Decimal(0), ge=0, le=1, description="税率")
    tax_amount: Decimal = Field(default=Decimal(0), ge=0, description="税额")
    net_amount: Decimal = Field(default=Decimal(0), ge=0, description="净金额")
    currency: str = Field("CNY", max_length=10, description="币种")
    exchange_rate: Decimal = Field(default=Decimal(1), gt=0, description="汇率")
    status: str = Field(default=DocumentStatus.DRAFT.value, max_length=20, description="订单状态")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")

    # 费用信息
    fee_details: Optional[List[dict]] = Field(None, description="费用明细 (JSON)")
    total_fee_amount: Decimal = Field(default=Decimal(0), ge=0, description="总费用金额")

    prepayment_amount: Optional[Decimal] = Field(None, ge=0, description="预付款金额")
    prepayment_bank_account_id: Optional[int] = Field(None, description="预付款银行账户ID")


class PurchaseOrderCreate(PurchaseOrderBase):
    """采购订单创建Schema"""
    order_code: Optional[str] = Field(None, max_length=50, description="订单编码")
    items: List["PurchaseOrderItemCreate"] = Field(..., description="订单明细")


class PurchaseOrderUpdate(PurchaseOrderBase):
    """采购订单更新Schema"""
    order_code: Optional[str] = Field(None, max_length=50, description="订单编码")
    items: Optional[List["PurchaseOrderItemUpdate"]] = Field(None, description="订单明细")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    fee_details: Optional[List[dict]] = Field(None, description="费用明细 (JSON)")
    total_fee_amount: Optional[Decimal] = Field(None, ge=0, description="总费用金额")
    change_reason: Optional[str] = Field(None, description="变更原因（当已审核/确认后变更时必填）")


class PurchaseOrderResponse(PurchaseOrderBase):
    """采购订单响应Schema"""
    id: int = Field(..., description="订单ID")
    tenant_id: int = Field(..., description="租户ID")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field(default=ReviewStatus.PENDING.value, max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    items: List["PurchaseOrderItemResponse"] = Field(default_factory=list, description="订单明细")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[PurchaseOrderCapabilities] = Field(
        None,
        description="业务态动作 capabilities（不含 RBAC，与 service 门禁一致）",
    )


class PurchaseOrderListResponse(PurchaseOrderResponse):
    """采购订单列表响应Schema"""
    items_count: Optional[int] = Field(None, description="订单明细条数（列表用）")
    downstream_push_progress: Optional[float] = Field(None, description="下推进度 0-100（列表用）")
    downstream_receipt_notice_codes: List[str] = Field(
        default_factory=list,
        description="下游收货通知单编码（列表 hover 用）",
    )
    downstream_purchase_receipt_codes: List[str] = Field(
        default_factory=list,
        description="下游采购入库单编码（列表 hover 用）",
    )
    received_total: Optional[Decimal] = Field(None, description="累计收货数量（列表用）")
    outstanding_total: Optional[Decimal] = Field(None, description="待收货数量（列表用）")
    receipt_progress: Optional[float] = Field(None, description="收货进度 0-100（列表用）")
    has_arrival_overdue: Optional[bool] = Field(
        None,
        description="是否存在逾期未关闭明细行（行级预警口径）",
    )


# === 采购订单明细 ===
class PurchaseOrderItemBase(BaseSchema):
    """采购订单明细基础Schema"""
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    ordered_quantity: Decimal = Field(..., gt=0, description="采购数量")
    unit: str = Field(..., max_length=20, description="单位")
    unit_price: Decimal = Field(..., ge=0, description="单价")
    total_price: Decimal = Field(..., ge=0, description="总价")
    price_settlement_status: Optional[str] = Field(None, max_length=20, description="定价状态")
    provisional_unit_price: Optional[Decimal] = Field(None, ge=0, description="暂估参考单价")
    received_quantity: Decimal = Field(default=Decimal(0), ge=0, description="已到货数量")
    outstanding_quantity: Decimal = Field(default=Decimal(0), ge=0, description="未到货数量")
    required_date: date = Field(..., description="要求到货日期")
    actual_delivery_date: Optional[date] = Field(None, description="实际到货日期")
    quality_requirements: Optional[str] = Field(None, description="质量要求")
    inspection_required: bool = Field(True, description="是否需要检验")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    demand_computation_item_id: Optional[int] = Field(None, description="需求计算明细ID")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    """采购订单明细创建Schema"""
    pass


class PurchaseOrderItemUpdate(PurchaseOrderItemBase):
    """采购订单明细更新Schema"""
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    ordered_quantity: Optional[Decimal] = Field(None, gt=0, description="采购数量")


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    """采购订单明细响应Schema"""
    id: int = Field(..., description="明细ID")
    order_id: int = Field(..., description="订单ID")
    price_settled_at: Optional[datetime] = Field(None, description="定价时间")
    price_settled_by: Optional[int] = Field(None, description="定价人ID")
    # V2 落地成本增强
    landing_cost: Decimal = Field(default=Decimal(0), description="落地成本")
    additional_fees_details: Optional[List[dict]] = Field(None, description="费用明细")


# === 扩展响应 ===
class MaterialPriceHistoryItem(BaseModel):
    """物料成交价记录项"""
    order_id: int
    order_code: str
    order_date: date
    supplier_id: int
    supplier_name: str
    unit_price: Decimal
    currency: Optional[str] = None

class MaterialPriceHistoryResponse(BaseModel):
    """物料成交价查询响应"""
    material_id: int
    history_items: List[MaterialPriceHistoryItem] = Field(default_factory=list)
    average_price: Decimal = Field(default=Decimal(0))
    min_price: Decimal = Field(default=Decimal(0))
    max_price: Decimal = Field(default=Decimal(0))


class PurchaseTrackingNode(BaseModel):
    """单据追踪节点信息"""
    node_name: str
    status: str
    time: Optional[datetime] = None
    operator: Optional[str] = None
    detail: Optional[str] = None
    is_completed: bool = False
    is_warning: bool = False

class PurchaseTrackingResponse(BaseModel):
    """全链路追踪响应"""
    order_id: int
    order_code: str
    overall_progress: int = 0
    nodes: List[PurchaseTrackingNode] = Field(default_factory=list)


# === V2 增强：比价与分摊 ===
class PriceComparisonItem(BaseModel):
    """比价条目"""
    supplier_id: int
    supplier_name: str
    last_price: Decimal
    last_order_date: Optional[date]
    delivery_lead_time: int  # Days


class MaterialPriceComparison(BaseModel):
    """物料比价汇总"""
    material_id: int
    material_name: str
    material_code: Optional[str] = None
    comparison: List[PriceComparisonItem] = Field(default_factory=list)


class PriceComparisonResponse(BaseModel):
    """多物料比价响应"""
    results: List[MaterialPriceComparison]


class LandingCostFeeItem(BaseModel):
    name: str = Field(..., description="费用名称（如：运费、关税）")
    amount: Decimal = Field(..., description="金额")


class LandingCostAllocationRequest(BaseModel):
    fee_items: List[LandingCostFeeItem] = Field(..., description="待分摊杂费列表")
    method: str = Field("by_value", description="分摊方式：by_value, by_quantity, by_weight, by_volume")


class PurchaseOrderChangeResponse(BaseModel):
    id: int
    order_id: int
    change_type: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    reason: Optional[str]
    operator_id: Optional[int]
    operator_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# === 其他请求 ===
class PurchaseOrderApprove(BaseModel):
    approved: bool
    review_remarks: Optional[str] = None


class PurchaseOrderConfirm(BaseModel):
    confirm_remarks: Optional[str] = None


class PurchaseOrderListParams(BaseModel):
    supplier_id: Optional[int] = None
    status: Optional[str] = None
    review_status: Optional[str] = None
    order_date_from: Optional[date] = None
    order_date_to: Optional[date] = None
    delivery_date_from: Optional[date] = None
    delivery_date_to: Optional[date] = None
    created_start_date: Optional[date] = None
    created_end_date: Optional[date] = None
    order_code: Optional[str] = None
    keyword: Optional[str] = None
    order_by: Optional[str] = None
    pullable_only: Optional[bool] = None
    pull_target: Optional[str] = None
    include_items: bool = False
    skip: int = 0
    limit: int = 20


class PurchaseReceiptPullCandidate(BaseModel):
    """采购入库选单弹窗候选项（含明细数量汇总）"""
    id: int
    order_code: str
    supplier_name: Optional[str] = None
    status: str
    order_date: Optional[date] = None
    delivery_date: Optional[date] = None
    items_count: Optional[int] = None
    ordered_total: Decimal = Field(default=Decimal(0), description="采购数量合计")
    received_total: Decimal = Field(default=Decimal(0), description="已入库数量合计")
    outstanding_total: Decimal = Field(default=Decimal(0), description="未入库数量合计")
    pullable: bool = Field(..., description="是否可取单（与 capabilities.push_receipt 一致）")
    lifecycle: Optional[dict] = Field(None, description="生命周期（入库进度展示）")
    capabilities: Optional[PurchaseOrderCapabilities] = Field(
        None,
        description="业务态动作 capabilities（不含 RBAC，与 service 门禁一致）",
    )


class PurchaseReceiptPullCandidateListResponse(BaseModel):
    data: List[PurchaseReceiptPullCandidate]
    total: int
    success: bool = True
