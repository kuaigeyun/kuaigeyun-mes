"""
仓储管理模块数据验证schema

提供仓储管理相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import Field, field_validator
from core.schemas.base import BaseSchema

from apps.kuaizhizao.services.document_action_policy.types import (
    SalesReturnCapabilities,
    PurchaseReturnCapabilities,
    InboundHubCapabilities,
    OutboundHubCapabilities,
)


# === 生产领料单 ===

class ProductionPickingBase(BaseSchema):
    """生产领料单基础schema"""
    picking_code: str = Field(..., max_length=50, description="领料单编码")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., max_length=50, description="工单编码")
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, max_length=100, description="车间名称")
    status: str = Field("待领料", max_length=20, description="领料状态")
    picker_id: Optional[int] = Field(None, description="领料人ID")
    picker_name: Optional[str] = Field(None, max_length=100, description="领料人姓名")
    picking_time: Optional[datetime] = Field(None, description="领料时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class ProductionPickingCreate(ProductionPickingBase):
    """生产领料单创建schema"""
    pass


class ProductionPickingUpdate(ProductionPickingBase):
    """生产领料单更新schema"""
    picking_code: Optional[str] = Field(None, max_length=50, description="领料单编码")


class ProductionPickingResponse(ProductionPickingBase):
    """生产领料单响应schema"""
    id: int = Field(..., description="领料单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    # 表头无仓库字段；由明细汇总供出库 Hub 列表/详情展示
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID（明细汇总，多仓时为空）")
    warehouse_name: Optional[str] = Field(None, description="出库仓库名称（明细汇总）")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[OutboundHubCapabilities] = Field(
        None, description="业务态 capabilities（出库 Hub，document_action_policy）",
    )

    class Config:
        from_attributes = True


class ProductionPickingListResponse(ProductionPickingResponse):
    """生产领料单列表响应schema（简化版）"""
    picking_score: Optional[float] = Field(None, description="备料场景综合分")
    picking_rank_band: Optional[str] = Field(None, description="备料等级带 A/B/C")
    picking_score_breakdown: Optional[dict] = Field(None, description="备料打分明细")
    total_quantity: Optional[float] = Field(None, ge=0, description="总数量（明细应领合计）")
    total_items: Optional[int] = Field(None, description="出库品种数（明细行数）")
    required_quantity_total: Optional[float] = Field(None, ge=0, description="应领数量合计（明细 required_quantity 之和）")
    picked_quantity_total: Optional[float] = Field(None, ge=0, description="已领数量合计（明细 picked_quantity 之和）")


class ProductionPickingWithItemsResponse(ProductionPickingResponse):
    """生产领料单详情响应（含明细）"""
    items: List["ProductionPickingItemResponse"] = Field(default_factory=list, description="领料明细列表")


class ProductionPickingPullLineCreate(BaseSchema):
    """生产领料 — 工单加载录入行"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_unit: str = Field("个", max_length=20, description="物料单位")
    issue_quantity: float = Field(..., gt=0, description="本次领料数量")
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID（明细行）")
    warehouse_name: Optional[str] = Field(None, max_length=100, description="出库仓库名称（明细行）")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表")


class ProductionPickingPullFromWorkOrderRequest(BaseSchema):
    """生产领料 — 从工单加载创建（单工单、带明细）"""
    work_order_id: int = Field(..., description="工单ID")
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID（表头默认，明细未指定时使用）")
    warehouse_name: Optional[str] = Field(None, max_length=100, description="出库仓库名称（表头默认）")
    picker_name: Optional[str] = Field(None, max_length=100, description="领料人姓名")
    notes: Optional[str] = Field(None, description="备注")
    lines: List[ProductionPickingPullLineCreate] = Field(..., min_length=1, description="领料明细")


# === 生产领料单明细 ===

class ProductionPickingItemBase(BaseSchema):
    """生产领料单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    required_quantity: float = Field(..., gt=0, description="需求数量")
    picked_quantity: float = Field(0, ge=0, description="已领料数量")
    remaining_quantity: float = Field(..., ge=0, description="剩余数量")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    status: str = Field("待领料", max_length=20, description="领料状态")
    picking_time: Optional[datetime] = Field(None, description="实际领料时间")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表")
    notes: Optional[str] = Field(None, description="备注")


class ProductionPickingItemCreate(ProductionPickingItemBase):
    """生产领料单明细创建schema"""
    pass


class ProductionPickingItemUpdate(ProductionPickingItemBase):
    """生产领料单明细更新schema"""
    pass


class ProductionPickingItemResponse(ProductionPickingItemBase):
    """生产领料单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    picking_id: int = Field(..., description="领料单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === 生产退料单 ===

class ProductionReturnBase(BaseSchema):
    """生产退料单基础schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="退料单编码（可选，不提供则自动生成）")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., max_length=50, description="工单编码")
    picking_id: Optional[int] = Field(None, description="领料单ID")
    picking_code: Optional[str] = Field(None, max_length=50, description="领料单编码")
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, max_length=100, description="车间名称")
    warehouse_id: int = Field(..., description="退料目标仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="退料目标仓库名称")
    status: str = Field("待退料", max_length=20, description="退料状态")
    returner_id: Optional[int] = Field(None, description="退料人ID")
    returner_name: Optional[str] = Field(None, max_length=100, description="退料人姓名")
    return_time: Optional[datetime] = Field(None, description="退料时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class ProductionReturnCreate(ProductionReturnBase):
    """生产退料单创建schema"""
    items: Optional[List["ProductionReturnItemCreate"]] = Field(None, description="退料明细列表")


class ProductionReturnUpdate(ProductionReturnBase):
    """生产退料单更新schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="退料单编码")


class ProductionReturnResponse(ProductionReturnBase):
    """生产退料单响应schema"""
    id: int = Field(..., description="退料单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    capabilities: Optional[InboundHubCapabilities] = Field(
        None, description="业务态 capabilities（入库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="入库品种数（明细行数）")

    class Config:
        from_attributes = True


class ProductionReturnListResponse(ProductionReturnResponse):
    """生产退料单列表响应schema（简化版）"""
    pass


# === 生产退料单明细 ===

class ProductionReturnItemBase(BaseSchema):
    """生产退料单明细基础schema"""
    picking_item_id: Optional[int] = Field(None, description="领料单明细ID")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    return_quantity: float = Field(..., gt=0, description="退料数量")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    status: str = Field("待退料", max_length=20, description="退料状态")
    return_time: Optional[datetime] = Field(None, description="实际退料时间")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    notes: Optional[str] = Field(None, description="备注")


class ProductionReturnItemCreate(ProductionReturnItemBase):
    """生产退料单明细创建schema"""
    pass


class ProductionReturnItemUpdate(ProductionReturnItemBase):
    """生产退料单明细更新schema"""
    pass


class ProductionReturnItemResponse(ProductionReturnItemBase):
    """生产退料单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    return_id: int = Field(..., description="退料单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class ProductionReturnWithItemsResponse(ProductionReturnResponse):
    """生产退料单详情响应（含明细）"""
    items: List[ProductionReturnItemResponse] = Field(default_factory=list, description="退料明细列表")


# === 入库创建预览（统一明细载入） ===

class InboundCreatePreviewLine(BaseSchema):
    """入库/退货创建 — 预览明细行"""
    sales_order_item_id: Optional[int] = Field(None, description="销售订单明细ID")
    picking_item_id: Optional[int] = Field(None, description="领料单明细ID")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(default="个", max_length=20, description="物料单位")
    source_doc_quantity: Optional[float] = Field(None, description="源单数量")
    source_received_quantity: Optional[float] = Field(None, description="已处理数量")
    source_pending_quantity: Optional[float] = Field(None, description="待处理数量")
    receipt_quantity: Optional[float] = Field(None, description="本次入库数量")
    return_quantity: Optional[float] = Field(None, description="本次退货/退料数量")
    unit_price: Optional[float] = Field(None, description="单价")


class WorkOrderInboundPreviewResponse(BaseSchema):
    """生产入库 — 工单预览"""
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    inbound_doc_kind: str = Field(..., description="finished_goods | semi_finished_goods")
    lines: List[InboundCreatePreviewLine] = Field(default_factory=list, description="预览明细")
    message: Optional[str] = Field(None, description="提示信息")


class ProductionReturnPreviewPicking(BaseSchema):
    """生产退料 — 领料单预览"""
    picking_id: int = Field(..., description="领料单ID")
    picking_code: str = Field(..., description="领料单编码")
    status: str = Field(..., description="领料单状态")
    lines: List[InboundCreatePreviewLine] = Field(default_factory=list, description="可退料明细")


class ProductionReturnPreviewResponse(BaseSchema):
    """生产退料 — 工单预览"""
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    pickings: List[ProductionReturnPreviewPicking] = Field(default_factory=list, description="可退料领料单")
    message: Optional[str] = Field(None, description="提示信息")


class SalesOrderReturnPreviewResponse(BaseSchema):
    """销售退货 — 订单预览"""
    sales_order_id: int = Field(..., description="销售订单ID")
    sales_order_code: str = Field(..., description="销售订单编码")
    lines: List[InboundCreatePreviewLine] = Field(default_factory=list, description="预览明细")
    message: Optional[str] = Field(None, description="提示信息")


# === 成品入库单 ===

class FinishedGoodsReceiptBase(BaseSchema):
    """成品入库单基础schema"""
    receipt_code: Optional[str] = Field(None, max_length=50, description="入库单编码（可选，如果不提供则自动生成）")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., max_length=50, description="工单编码")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码")
    warehouse_id: int = Field(..., description="入库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="入库仓库名称")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    receiver_id: Optional[int] = Field(None, description="入库人ID")
    receiver_name: Optional[str] = Field(None, max_length=100, description="入库人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待入库", max_length=20, description="入库状态")
    total_quantity: float = Field(0, ge=0, description="总入库数量")
    notes: Optional[str] = Field(None, description="备注")


class FinishedGoodsReceiptCreate(FinishedGoodsReceiptBase):
    """成品入库单创建schema"""
    items: Optional[List["FinishedGoodsReceiptItemCreate"]] = Field(None, description="入库明细列表")


class FinishedGoodsReceiptUpdate(FinishedGoodsReceiptBase):
    """成品入库单更新schema"""
    receipt_code: Optional[str] = Field(None, max_length=50, description="入库单编码")


class FinishedGoodsReceiptResponse(FinishedGoodsReceiptBase):
    """成品入库单响应schema"""
    id: int = Field(..., description="入库单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    capabilities: Optional[InboundHubCapabilities] = Field(
        None, description="业务态 capabilities（入库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="入库品种数（明细行数）")
    inbound_doc_kind: Literal["finished_goods", "semi_finished_goods"] = Field(
        "finished_goods",
        description="生产入库单据形态（成品/半成品），与物理表一致时下推接口可能返回 semi 以兼容旧客户端",
    )

    class Config:
        from_attributes = True


class FinishedGoodsReceiptWithItemsResponse(FinishedGoodsReceiptResponse):
    """成品入库单详情响应（含明细）"""
    items: List["FinishedGoodsReceiptItemResponse"] = Field(default_factory=list, description="入库明细列表")


# === 成品入库单明细 ===

class FinishedGoodsReceiptItemBase(BaseSchema):
    """成品入库单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    receipt_quantity: float = Field(..., gt=0, description="入库数量")
    qualified_quantity: float = Field(..., ge=0, description="合格数量")
    unqualified_quantity: float = Field(..., ge=0, description="不合格数量")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    quality_status: str = Field("合格", max_length=20, description="质量状态")
    quality_inspection_id: Optional[int] = Field(None, description="质量检验单ID")
    status: str = Field("待入库", max_length=20, description="入库状态")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    notes: Optional[str] = Field(None, description="备注")


class FinishedGoodsReceiptItemCreate(FinishedGoodsReceiptItemBase):
    """成品入库单明细创建schema"""
    pass


class FinishedGoodsReceiptItemUpdate(FinishedGoodsReceiptItemBase):
    """成品入库单明细更新schema"""
    pass


class FinishedGoodsReceiptItemResponse(FinishedGoodsReceiptItemBase):
    """成品入库单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    receipt_id: int = Field(..., description="入库单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === 半成品入库单（结构同成品入库单，单据类型独立） ===

class SemiFinishedGoodsReceiptBase(BaseSchema):
    """半成品入库单基础 schema"""
    receipt_code: Optional[str] = Field(None, max_length=50, description="入库单编码（可选，如果不提供则自动生成）")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., max_length=50, description="工单编码")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码")
    warehouse_id: int = Field(..., description="入库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="入库仓库名称")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    receiver_id: Optional[int] = Field(None, description="入库人ID")
    receiver_name: Optional[str] = Field(None, max_length=100, description="入库人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待入库", max_length=20, description="入库状态")
    total_quantity: float = Field(0, ge=0, description="总入库数量")
    notes: Optional[str] = Field(None, description="备注")


class SemiFinishedGoodsReceiptCreate(SemiFinishedGoodsReceiptBase):
    """半成品入库单创建 schema"""
    items: Optional[List["SemiFinishedGoodsReceiptItemCreate"]] = Field(None, description="入库明细列表")


class SemiFinishedGoodsReceiptUpdate(SemiFinishedGoodsReceiptBase):
    """半成品入库单更新 schema"""
    receipt_code: Optional[str] = Field(None, max_length=50, description="入库单编码")


class SemiFinishedGoodsReceiptResponse(SemiFinishedGoodsReceiptBase):
    """半成品入库单响应 schema"""
    id: int = Field(..., description="入库单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    capabilities: Optional[InboundHubCapabilities] = Field(
        None, description="业务态 capabilities（入库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="入库品种数（明细行数）")
    inbound_doc_kind: Literal["finished_goods", "semi_finished_goods"] = Field(
        "semi_finished_goods",
        description="固定为半成品入库单",
    )

    class Config:
        from_attributes = True


class SemiFinishedGoodsReceiptWithItemsResponse(SemiFinishedGoodsReceiptResponse):
    """半成品入库单详情响应（含明细）"""
    items: List["SemiFinishedGoodsReceiptItemResponse"] = Field(default_factory=list, description="入库明细列表")


class SemiFinishedGoodsReceiptItemBase(BaseSchema):
    """半成品入库单明细基础 schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    receipt_quantity: float = Field(..., gt=0, description="入库数量")
    qualified_quantity: float = Field(..., ge=0, description="合格数量")
    unqualified_quantity: float = Field(..., ge=0, description="不合格数量")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    quality_status: str = Field("合格", max_length=20, description="质量状态")
    quality_inspection_id: Optional[int] = Field(None, description="质量检验单ID")
    status: str = Field("待入库", max_length=20, description="入库状态")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    notes: Optional[str] = Field(None, description="备注")


class SemiFinishedGoodsReceiptItemCreate(SemiFinishedGoodsReceiptItemBase):
    """半成品入库单明细创建 schema"""
    pass


class SemiFinishedGoodsReceiptItemUpdate(SemiFinishedGoodsReceiptItemBase):
    """半成品入库单明细更新 schema"""
    pass


class SemiFinishedGoodsReceiptItemResponse(SemiFinishedGoodsReceiptItemBase):
    """半成品入库单明细响应 schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    receipt_id: int = Field(..., description="入库单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === 销售出库单 ===

class SalesDeliveryBase(BaseSchema):
    """销售出库单基础schema"""
    delivery_code: Optional[str] = Field(None, max_length=50, description="出库单编码（可选，如果不提供则自动生成）")
    
    # 销售订单信息（MTO模式，MTS模式可为空）
    sales_order_id: Optional[int] = Field(None, description="销售订单ID（MTO模式）")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码（MTO模式）")
    
    # 销售预测信息（MTS模式，MTO模式可为空）
    sales_forecast_id: Optional[int] = Field(None, description="销售预测ID（MTS模式）")
    sales_forecast_code: Optional[str] = Field(None, max_length=50, description="销售预测编码（MTS模式）")
    
    # 统一需求关联（销售出库与需求关联功能增强）
    demand_id: Optional[int] = Field(None, description="需求ID（关联统一需求表，MTS关联销售预测，MTO关联销售订单）")
    demand_code: Optional[str] = Field(None, max_length=50, description="需求编码")
    demand_type: Optional[str] = Field(None, max_length=20, description="需求类型（sales_forecast/sales_order）")
    
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    warehouse_id: int = Field(..., description="出库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="出库仓库名称")
    delivery_time: Optional[datetime] = Field(None, description="实际出库时间")
    deliverer_id: Optional[int] = Field(None, description="出库人ID")
    deliverer_name: Optional[str] = Field(None, max_length=100, description="出库人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待出库", max_length=20, description="出库状态")
    total_quantity: float = Field(0, ge=0, description="总出库数量")
    total_amount: float = Field(0, ge=0, description="总金额")
    shipping_method: Optional[str] = Field(None, max_length=50, description="发货方式")
    tracking_number: Optional[str] = Field(None, max_length=100, description="物流单号")
    shipping_address: Optional[str] = Field(None, description="收货地址")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class SalesDeliveryCreate(SalesDeliveryBase):
    """销售出库单创建schema"""
    items: Optional[List["SalesDeliveryItemCreate"]] = Field(None, description="出库明细列表")


class SalesDeliveryUpdate(SalesDeliveryBase):
    """销售出库单更新schema"""
    delivery_code: Optional[str] = Field(None, max_length=50, description="出库单编码")


class SalesDeliveryResponse(SalesDeliveryBase):
    """销售出库单响应schema"""
    id: int = Field(..., description="出库单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[OutboundHubCapabilities] = Field(
        None, description="业务态 capabilities（出库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="出库品种数（明细行数）")

    class Config:
        from_attributes = True


class SalesDeliveryWithItemsResponse(SalesDeliveryResponse):
    """销售出库单详情响应（含明细）"""
    items: List["SalesDeliveryItemResponse"] = Field(default_factory=list, description="出库明细列表")


# === 销售出库单明细 ===

class SalesDeliveryItemBase(BaseSchema):
    """销售出库单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    delivery_quantity: float = Field(..., gt=0, description="出库数量")
    unit_price: float = Field(..., ge=0, description="单价")
    total_amount: float = Field(..., ge=0, description="金额")
    is_gift: bool = Field(False, description="是否赠品")
    gift_ref_unit_price: Optional[float] = Field(None, ge=0, description="赠品参考单价")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    
    # 批次信息（批号和序列号选择功能增强）
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    
    # 序列号信息（批号和序列号选择功能增强）
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表（存储多个序列号）")
    
    # 需求关联（销售出库与需求关联功能增强）
    demand_id: Optional[int] = Field(None, description="需求ID（关联统一需求表）")
    demand_item_id: Optional[int] = Field(None, description="需求明细ID")
    
    status: str = Field("待出库", max_length=20, description="出库状态")
    delivery_time: Optional[datetime] = Field(None, description="实际出库时间")
    notes: Optional[str] = Field(None, description="备注")


class SalesDeliveryItemCreate(SalesDeliveryItemBase):
    """销售出库单明细创建schema"""
    pass


class SalesDeliveryItemUpdate(SalesDeliveryItemBase):
    """销售出库单明细更新schema"""
    pass


class SalesDeliveryItemResponse(SalesDeliveryItemBase):
    """销售出库单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    delivery_id: int = Field(..., description="出库单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class SalesDeliveryConfirmItemBatch(BaseSchema):
    """确认销售出库时单行批号提交"""

    item_id: int = Field(..., description="销售出库明细 ID（sales_delivery_items.id）")
    batch_no: str = Field(default="", max_length=50, description="出库批号（批号管理物料必填）")


class SalesDeliveryConfirmRequest(BaseSchema):
    """确认销售出库请求体（可选，用于提交各行批号/库位/序列号或出库确认通用字段）"""

    item_batches: Optional[List[SalesDeliveryConfirmItemBatch]] = Field(
        default=None,
        description="各行批号；传入时须覆盖本单所有「出库数量>0」的明细行 id",
    )
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID（若提供则覆盖表头未指定者）")
    warehouse_name: Optional[str] = Field(None, description="出库仓库名称")
    delivery_time: Optional[datetime] = Field(None, description="出库时间")
    notes: Optional[str] = Field(None, description="确认备注")
    items: Optional[List["OutboundConfirmationItem"]] = Field(
        None,
        description="明细更新（可选，用于补全库位/批号/序列号等）",
    )


# === 采购入库单 ===

class PurchaseReceiptBase(BaseSchema):
    """采购入库单基础schema"""
    receipt_code: Optional[str] = Field(None, max_length=50, description="入库单编码（可选，不提供则自动生成）")
    purchase_order_id: int = Field(0, description="采购订单ID（手动创建时为0）")
    purchase_order_code: str = Field("", max_length=50, description="采购订单编码（手动创建时为空）")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    warehouse_id: int = Field(..., description="入库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="入库仓库名称")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    receiver_id: Optional[int] = Field(None, description="入库人ID")
    receiver_name: Optional[str] = Field(None, max_length=100, description="入库人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待入库", max_length=20, description="入库状态")
    total_quantity: float = Field(0, ge=0, description="总入库数量")
    total_amount: float = Field(0, ge=0, description="总金额")
    delivery_note: Optional[str] = Field(None, max_length=100, description="送货单号")
    invoice_number: Optional[str] = Field(None, max_length=100, description="发票号")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


# === 采购入库单明细 ===

class PurchaseReceiptItemBase(BaseSchema):
    """采购入库单明细基础schema"""
    purchase_order_item_id: int = Field(0, description="采购订单明细ID（手动创建时为0）")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    receipt_quantity: float = Field(..., gt=0, description="入库数量")
    unit_price: float = Field(..., ge=0, description="单价")
    total_amount: float = Field(..., ge=0, description="金额")
    qualified_quantity: float = Field(..., ge=0, description="合格数量")
    unqualified_quantity: float = Field(..., ge=0, description="不合格数量")
    quality_status: str = Field("合格", max_length=20, description="质量状态")
    warehouse_id: Optional[int] = Field(None, description="行入库仓库ID（可与表头不同）")
    warehouse_name: Optional[str] = Field(None, max_length=100, description="行入库仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    manufacturing_date: Optional[datetime] = Field(None, description="生产日期")
    status: str = Field("待入库", max_length=20, description="入库状态")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseReceiptItemCreate(PurchaseReceiptItemBase):
    """采购入库单明细创建 schema（编码/名称/金额可由服务端按 material_id 补全）"""
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    total_amount: Optional[float] = Field(None, ge=0, description="金额")


class PurchaseReceiptItemUpdate(PurchaseReceiptItemBase):
    """采购入库单明细更新schema"""
    pass


class PurchaseReceiptItemResponse(PurchaseReceiptItemBase):
    """采购入库单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    receipt_id: int = Field(..., description="入库单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")

    class Config:
        from_attributes = True


# === 采购入库单（主表，需要在明细之后定义） ===

class PurchaseReceiptCreate(PurchaseReceiptBase):
    """采购入库单创建schema"""
    items: Optional[List[PurchaseReceiptItemCreate]] = Field(default_factory=list, description="入库单明细列表")


class PurchaseReceiptUpdate(PurchaseReceiptBase):
    """采购入库单更新schema"""
    receipt_code: Optional[str] = Field(None, max_length=50, description="入库单编码")
    items: Optional[List[PurchaseReceiptItemUpdate]] = Field(
        None, description="入库单明细列表（传入则全量替换）"
    )


class PurchaseReceiptResponse(PurchaseReceiptBase):
    """采购入库单响应schema"""
    id: int = Field(..., description="入库单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[InboundHubCapabilities] = Field(
        None, description="业务态 capabilities（入库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="入库品种数（明细行数）")

    class Config:
        from_attributes = True


class PurchaseReceiptWithItemsResponse(PurchaseReceiptResponse):
    """采购入库单详情响应（含明细）"""
    items: List[PurchaseReceiptItemResponse] = Field(default_factory=list, description="入库明细列表")


# === 销售退货单 ===

class SalesReturnBase(BaseSchema):
    """销售退货单基础schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="退货单编码（可选，如果不提供则自动生成）")
    
    # 销售出库单信息（关联原出库单）
    sales_delivery_id: Optional[int] = Field(None, description="销售出库单ID")
    sales_delivery_code: Optional[str] = Field(None, max_length=50, description="销售出库单编码")
    
    # 销售订单信息（用于追溯）
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码")
    
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    warehouse_id: int = Field(..., description="退货入库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="退货入库仓库名称")
    return_time: Optional[datetime] = Field(None, description="实际退货时间")
    returner_id: Optional[int] = Field(None, description="退货人ID")
    returner_name: Optional[str] = Field(None, max_length=100, description="退货人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("草稿", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    
    # 退货原因
    return_reason: Optional[str] = Field(None, max_length=200, description="退货原因")
    return_type: str = Field("质量问题", max_length=20, description="退货类型（质量问题/客户取消/其他）")
    
    status: str = Field("待退货", max_length=20, description="退货状态")
    total_quantity: float = Field(0, ge=0, description="总退货数量")
    total_amount: float = Field(0, ge=0, description="总金额")
    shipping_method: Optional[str] = Field(None, max_length=50, description="退货方式")
    tracking_number: Optional[str] = Field(None, max_length=100, description="物流单号")
    shipping_address: Optional[str] = Field(None, description="退货地址")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class SalesReturnCreate(SalesReturnBase):
    """销售退货单创建schema"""
    items: Optional[List["SalesReturnItemCreate"]] = Field(None, description="退货明细列表")


class SalesReturnUpdate(SalesReturnBase):
    """销售退货单更新schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="退货单编码")
    items: Optional[List["SalesReturnItemCreate"]] = Field(
        None, description="退货明细（传入则先删后插，全量替换）"
    )


class SalesReturnResponse(SalesReturnBase):
    """销售退货单响应schema"""
    id: int = Field(..., description="退货单ID")
    tenant_id: int = Field(..., description="租户ID")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[SalesReturnCapabilities] = Field(
        None,
        description="业务态动作 capabilities（不含 RBAC，与 service 门禁一致）",
    )
    total_items: Optional[int] = Field(None, description="退货品种数（明细行数）")
    items: Optional[List["SalesReturnItemResponse"]] = Field(None, description="退货明细列表")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")

    class Config:
        from_attributes = True


class SalesReturnListPaginatedResponse(BaseSchema):
    """销售退货单分页列表"""
    data: List[SalesReturnResponse]
    total: int
    success: bool = True


# === 销售退货单明细 ===

class SalesReturnItemBase(BaseSchema):
    """销售退货单明细基础schema"""
    # 关联原销售出库单明细
    sales_delivery_item_id: Optional[int] = Field(None, description="销售出库单明细ID")
    
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    return_quantity: float = Field(..., gt=0, description="退货数量")
    unit_price: float = Field(..., ge=0, description="单价")
    total_amount: float = Field(..., ge=0, description="金额")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    
    # 批次信息（批号和序列号选择功能增强）
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    
    # 序列号信息（批号和序列号选择功能增强）
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表（存储多个序列号）")
    
    status: str = Field("待退货", max_length=20, description="退货状态")
    return_time: Optional[datetime] = Field(None, description="实际退货时间")
    notes: Optional[str] = Field(None, description="备注")


class SalesReturnItemCreate(SalesReturnItemBase):
    """销售退货单明细创建schema"""
    pass


class SalesReturnItemUpdate(SalesReturnItemBase):
    """销售退货单明细更新schema"""
    pass


class SalesReturnItemResponse(SalesReturnItemBase):
    """销售退货单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    return_id: int = Field(..., description="退货单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === 采购退货单 ===

class PurchaseReturnBase(BaseSchema):
    """采购退货单基础schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="退货单编码（可选，如果不提供则自动生成）")
    
    # 采购入库单信息（关联原入库单）
    purchase_receipt_id: Optional[int] = Field(None, description="采购入库单ID")
    purchase_receipt_code: Optional[str] = Field(None, max_length=50, description="采购入库单编码")
    
    # 采购订单信息（用于追溯）
    purchase_order_id: Optional[int] = Field(None, description="采购订单ID")
    purchase_order_code: Optional[str] = Field(None, max_length=50, description="采购订单编码")
    
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    warehouse_id: int = Field(..., description="退货出库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="退货出库仓库名称")
    return_time: Optional[datetime] = Field(None, description="实际退货时间")
    returner_id: Optional[int] = Field(None, description="退货人ID")
    returner_name: Optional[str] = Field(None, max_length=100, description="退货人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    
    # 退货原因
    return_reason: Optional[str] = Field(None, max_length=200, description="退货原因")
    return_type: str = Field("质量问题", max_length=20, description="退货类型（质量问题/供应商取消/其他）")
    
    status: str = Field("待退货", max_length=20, description="退货状态")
    total_quantity: float = Field(0, ge=0, description="总退货数量")
    total_amount: float = Field(0, ge=0, description="总金额")
    shipping_method: Optional[str] = Field(None, max_length=50, description="退货方式")
    tracking_number: Optional[str] = Field(None, max_length=100, description="物流单号")
    shipping_address: Optional[str] = Field(None, description="退货地址")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class PurchaseReturnCreate(PurchaseReturnBase):
    """采购退货单创建schema"""
    items: Optional[List["PurchaseReturnItemCreate"]] = Field(None, description="退货明细列表")


class PurchaseReturnUpdate(PurchaseReturnBase):
    """采购退货单更新schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="退货单编码")


class PurchaseReturnResponse(PurchaseReturnBase):
    """采购退货单响应schema"""
    id: int = Field(..., description="退货单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    capabilities: Optional[PurchaseReturnCapabilities] = Field(
        None,
        description="业务态动作 capabilities（不含 RBAC，与 service 门禁一致）",
    )
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycle/Stepper 展示）")

    class Config:
        from_attributes = True


class PurchaseReturnListPaginatedResponse(BaseSchema):
    """采购退货单分页列表"""
    data: List[PurchaseReturnResponse]
    total: int
    success: bool = True


# === 采购退货单明细 ===

class PurchaseReturnItemBase(BaseSchema):
    """采购退货单明细基础schema"""
    # 关联原采购入库单明细
    purchase_receipt_item_id: Optional[int] = Field(None, description="采购入库单明细ID")
    
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    return_quantity: float = Field(..., gt=0, description="退货数量")
    unit_price: float = Field(..., ge=0, description="单价")
    total_amount: float = Field(..., ge=0, description="金额")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    
    # 批次信息（批号和序列号选择功能增强）
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    
    # 序列号信息（批号和序列号选择功能增强）
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表（存储多个序列号）")
    
    status: str = Field("待退货", max_length=20, description="退货状态")
    return_time: Optional[datetime] = Field(None, description="实际退货时间")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseReturnItemCreate(PurchaseReturnItemBase):
    """采购退货单明细创建schema"""
    pass


class PurchaseReturnItemUpdate(PurchaseReturnItemBase):
    """采购退货单明细更新schema"""
    pass


class PurchaseReturnItemResponse(PurchaseReturnItemBase):
    """采购退货单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    return_id: int = Field(..., description="退货单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === 其他入库单 ===

OtherInboundReasonType = Literal["盘盈", "调拨", "样品", "报废", "其他"]


def normalize_other_inbound_reason_type(value: str) -> str:
    """归一化其他入库原因：字典「调拨入库」等与 schema 对齐为「调拨」。"""
    normalized = (value or "").strip()
    if normalized == "调拨入库":
        return "调拨"
    return normalized


class OtherInboundBase(BaseSchema):
    """其他入库单基础schema"""
    inbound_code: Optional[str] = Field(None, max_length=50, description="入库单编码（可选，不提供则自动生成）")
    reason_type: OtherInboundReasonType = Field(..., description="原因类型：盘盈/调拨/样品/报废/其他")
    reason_desc: Optional[str] = Field(None, description="原因说明")
    warehouse_id: int = Field(..., description="入库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="入库仓库名称")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    receiver_id: Optional[int] = Field(None, description="入库人ID")
    receiver_name: Optional[str] = Field(None, max_length=100, description="入库人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待入库", max_length=20, description="入库状态")
    total_quantity: float = Field(0, ge=0, description="总入库数量")
    total_amount: float = Field(0, ge=0, description="总金额")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")

    @field_validator("reason_type", mode="before")
    @classmethod
    def _normalize_reason_type(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_other_inbound_reason_type(value)
        return value


class OtherInboundCreate(OtherInboundBase):
    """其他入库单创建schema"""
    items: Optional[List["OtherInboundItemCreate"]] = Field(None, description="入库明细列表")


class OtherInboundUpdate(OtherInboundBase):
    """其他入库单更新schema"""
    inbound_code: Optional[str] = Field(None, max_length=50, description="入库单编码")


class OtherInboundResponse(OtherInboundBase):
    """其他入库单响应schema"""
    id: int = Field(..., description="入库单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[InboundHubCapabilities] = Field(
        None, description="业务态 capabilities（入库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="入库品种数（明细行数）")

    class Config:
        from_attributes = True


class OtherInboundListResponse(OtherInboundResponse):
    """其他入库单列表响应schema（简化版）"""
    pass


# === 其他入库单明细 ===

class OtherInboundItemBase(BaseSchema):
    """其他入库单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    inbound_quantity: float = Field(..., gt=0, description="入库数量")
    unit_price: float = Field(0, ge=0, description="单价")
    total_amount: float = Field(0, ge=0, description="金额")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    status: str = Field("待入库", max_length=20, description="入库状态")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    notes: Optional[str] = Field(None, description="备注")


class OtherInboundItemCreate(OtherInboundItemBase):
    """其他入库单明细创建 schema（编码/名称/金额可由服务端按 material_id 补全）"""
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    total_amount: Optional[float] = Field(None, ge=0, description="金额")


class OtherInboundItemUpdate(OtherInboundItemBase):
    """其他入库单明细更新schema"""
    pass


class OtherInboundItemResponse(OtherInboundItemBase):
    """其他入库单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    inbound_id: int = Field(..., description="入库单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class OtherInboundWithItemsResponse(OtherInboundResponse):
    """其他入库单详情响应（含明细）"""
    items: List[OtherInboundItemResponse] = Field(default_factory=list, description="入库明细列表")


# === 其他出库单 ===

OtherOutboundReasonType = Literal["盘亏", "样品", "报废", "其他"]


class OtherOutboundBase(BaseSchema):
    """其他出库单基础schema"""
    outbound_code: Optional[str] = Field(None, max_length=50, description="出库单编码（可选，不提供则自动生成）")
    reason_type: OtherOutboundReasonType = Field(..., description="原因类型：盘亏/样品/报废/其他")
    reason_desc: Optional[str] = Field(None, description="原因说明")
    warehouse_id: int = Field(..., description="出库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="出库仓库名称")
    delivery_time: Optional[datetime] = Field(None, description="实际出库时间")
    deliverer_id: Optional[int] = Field(None, description="出库人ID")
    deliverer_name: Optional[str] = Field(None, max_length=100, description="出库人姓名")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待出库", max_length=20, description="出库状态")
    total_quantity: float = Field(0, ge=0, description="总出库数量")
    total_amount: float = Field(0, ge=0, description="总金额")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class OtherOutboundCreate(OtherOutboundBase):
    """其他出库单创建schema"""
    items: Optional[List["OtherOutboundItemCreate"]] = Field(None, description="出库明细列表")


class OtherOutboundUpdate(OtherOutboundBase):
    """其他出库单更新schema"""
    outbound_code: Optional[str] = Field(None, max_length=50, description="出库单编码")


class OtherOutboundResponse(OtherOutboundBase):
    """其他出库单响应schema"""
    id: int = Field(..., description="出库单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[OutboundHubCapabilities] = Field(
        None, description="业务态 capabilities（出库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="出库品种数（明细行数）")

    class Config:
        from_attributes = True


class OtherOutboundListResponse(OtherOutboundResponse):
    """其他出库单列表响应schema（简化版）"""
    pass


# === 其他出库单明细 ===

class OtherOutboundItemBase(BaseSchema):
    """其他出库单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    outbound_quantity: float = Field(..., gt=0, description="出库数量")
    unit_price: float = Field(0, ge=0, description="单价")
    total_amount: float = Field(0, ge=0, description="金额")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    status: str = Field("待出库", max_length=20, description="出库状态")
    delivery_time: Optional[datetime] = Field(None, description="实际出库时间")
    notes: Optional[str] = Field(None, description="备注")


class OtherOutboundItemCreate(OtherOutboundItemBase):
    """其他出库单明细创建 schema（编码/名称/金额可由服务端按 material_id 补全）"""
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    total_amount: Optional[float] = Field(None, ge=0, description="金额")


class OtherOutboundItemUpdate(OtherOutboundItemBase):
    """其他出库单明细更新schema"""
    pass


class OtherOutboundItemResponse(OtherOutboundItemBase):
    """其他出库单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    outbound_id: int = Field(..., description="出库单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class OtherOutboundWithItemsResponse(OtherOutboundResponse):
    """其他出库单详情响应（含明细）"""
    items: List[OtherOutboundItemResponse] = Field(default_factory=list, description="出库明细列表")


# === 借料单 ===


class MaterialBorrowBase(BaseSchema):
    """借料单基础schema"""
    borrow_code: Optional[str] = Field(None, max_length=50, description="借料单编码（可选，不提供则自动生成）")
    warehouse_id: int = Field(..., description="借出仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="借出仓库名称")
    borrower_id: Optional[int] = Field(None, description="借料人ID")
    borrower_name: Optional[str] = Field(None, max_length=100, description="借料人姓名")
    department: Optional[str] = Field(None, max_length=100, description="部门")
    expected_return_date: Optional[datetime] = Field(None, description="预计归还日期")
    borrow_time: Optional[datetime] = Field(None, description="实际借出时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待借出", max_length=20, description="借料状态")
    total_quantity: float = Field(0, ge=0, description="总借出数量")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class MaterialBorrowCreate(MaterialBorrowBase):
    """借料单创建schema"""
    items: Optional[List["MaterialBorrowItemCreate"]] = Field(None, description="借料明细列表")


class MaterialBorrowUpdate(MaterialBorrowBase):
    """借料单更新schema"""
    borrow_code: Optional[str] = Field(None, max_length=50, description="借料单编码")


class MaterialBorrowResponse(MaterialBorrowBase):
    """借料单响应schema"""
    id: int = Field(..., description="借料单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[OutboundHubCapabilities] = Field(
        None, description="业务态 capabilities（出库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="出库品种数（明细行数）")

    class Config:
        from_attributes = True


class MaterialBorrowListResponse(MaterialBorrowResponse):
    """借料单列表响应schema"""
    pass


# === 借料单明细 ===


class MaterialBorrowItemBase(BaseSchema):
    """借料单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    borrow_quantity: float = Field(..., gt=0, description="借出数量")
    returned_quantity: float = Field(0, ge=0, description="已归还数量")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    status: str = Field("待借出", max_length=20, description="借料状态")
    borrow_time: Optional[datetime] = Field(None, description="实际借出时间")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    notes: Optional[str] = Field(None, description="备注")


class MaterialBorrowItemCreate(MaterialBorrowItemBase):
    """借料单明细创建schema"""
    pass


class MaterialBorrowItemUpdate(MaterialBorrowItemBase):
    """借料单明细更新schema"""
    pass


class MaterialBorrowItemResponse(MaterialBorrowItemBase):
    """借料单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    borrow_id: int = Field(..., description="借料单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class MaterialBorrowWithItemsResponse(MaterialBorrowResponse):
    """借料单详情响应（含明细）"""
    items: List[MaterialBorrowItemResponse] = Field(default_factory=list, description="借料明细列表")


# === 还料单 ===


class MaterialReturnBase(BaseSchema):
    """还料单基础schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="还料单编码（可选，不提供则自动生成）")
    borrow_id: int = Field(..., description="借料单ID")
    borrow_code: str = Field(..., max_length=50, description="借料单编码")
    warehouse_id: int = Field(..., description="归还仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="归还仓库名称")
    returner_id: Optional[int] = Field(None, description="归还人ID")
    returner_name: Optional[str] = Field(None, max_length=100, description="归还人姓名")
    return_time: Optional[datetime] = Field(None, description="实际归还时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    status: str = Field("待归还", max_length=20, description="还料状态")
    total_quantity: float = Field(0, ge=0, description="总归还数量")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class MaterialReturnCreate(MaterialReturnBase):
    """还料单创建schema"""
    items: Optional[List["MaterialReturnItemCreate"]] = Field(None, description="还料明细列表")


class MaterialReturnUpdate(MaterialReturnBase):
    """还料单更新schema"""
    return_code: Optional[str] = Field(None, max_length=50, description="还料单编码")


class MaterialReturnResponse(MaterialReturnBase):
    """还料单响应schema"""
    id: int = Field(..., description="还料单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[InboundHubCapabilities] = Field(
        None, description="业务态 capabilities（入库 Hub，document_action_policy）",
    )
    total_items: Optional[int] = Field(None, description="入库品种数（明细行数）")

    class Config:
        from_attributes = True


class MaterialReturnListResponse(MaterialReturnResponse):
    """还料单列表响应schema"""
    pass


# === 还料单明细 ===


class MaterialReturnItemBase(BaseSchema):
    """还料单明细基础schema"""
    borrow_item_id: Optional[int] = Field(None, description="借料单明细ID")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    return_quantity: float = Field(..., gt=0, description="归还数量")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    status: str = Field("待归还", max_length=20, description="还料状态")
    return_time: Optional[datetime] = Field(None, description="实际归还时间")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    notes: Optional[str] = Field(None, description="备注")


class MaterialReturnItemCreate(MaterialReturnItemBase):
    """还料单明细创建schema"""
    pass


class MaterialReturnItemUpdate(MaterialReturnItemBase):
    """还料单明细更新schema"""
    pass


class MaterialReturnItemResponse(MaterialReturnItemBase):
    """还料单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    return_id: int = Field(..., description="还料单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class MaterialReturnWithItemsResponse(MaterialReturnResponse):
    """还料单详情响应（含明细）"""
    items: List[MaterialReturnItemResponse] = Field(default_factory=list, description="还料明细列表")


# === 物料备料提醒 ===

class MaterialPrepReminderItem(BaseSchema):
    """物料备料提醒项"""
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    product_name: str = Field(..., description="产品名称")
    quantity: float = Field(..., description="工单数量")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    priority: str = Field("normal", description="优先级")
    kitting_rate: float = Field(..., description="齐套率")
    kitting_status: str = Field(..., description="齐套状态")
    composite_score: Optional[float] = Field(None, description="备料场景综合分")
    score_breakdown: Optional[dict] = Field(None, description="打分明细")
    suggested_warehouse_id: Optional[int] = Field(None, description="建议主仓ID")
    suggested_warehouse_name: Optional[str] = Field(None, description="建议主仓名称")


class MaterialPrepReminderResponse(BaseSchema):
    """物料备料提醒响应"""
    items: List[MaterialPrepReminderItem] = Field(default_factory=list, description="提醒项列表")
    total_count: int = Field(0, description="总条数")


# === 入库确认通用 Schema ===

class InboundConfirmationItem(BaseSchema):
    """入库确认明细字段（支持在确认时补齐或修改批号/库位/仓库）"""
    item_id: int = Field(..., description="明细ID")
    warehouse_id: Optional[int] = Field(None, description="入库仓库ID")
    warehouse_name: Optional[str] = Field(None, description="入库仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, description="库位编码")
    batch_number: Optional[str] = Field(None, description="批次号")
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    manufacturing_date: Optional[datetime] = Field(None, description="生产日期")


class InboundConfirmationRequest(BaseSchema):
    """入库确认通用请求"""
    warehouse_id: Optional[int] = Field(None, description="总入库仓库ID（若提供则覆盖表头和明细未指定者）")
    warehouse_name: Optional[str] = Field(None, description="入库仓库名称")
    receipt_time: Optional[datetime] = Field(None, description="入库时间")
    notes: Optional[str] = Field(None, description="确认备注")
    items: Optional[List[InboundConfirmationItem]] = Field(None, description="明细更新（可选，用于补全批号/序列号等）")


# === 出库确认通用 Schema ===

class OutboundConfirmationItem(BaseSchema):
    """出库确认明细字段（支持在确认时补齐或修改批号/库位/仓库/序列号）"""
    item_id: int = Field(..., description="明细ID")
    warehouse_id: Optional[int] = Field(None, description="出库仓库ID")
    warehouse_name: Optional[str] = Field(None, description="出库仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, description="库位编码")
    batch_number: Optional[str] = Field(None, description="批次号")
    serial_numbers: Optional[List[str]] = Field(None, description="序列号列表")


class OutboundConfirmationRequest(BaseSchema):
    """出库确认通用请求"""
    warehouse_id: Optional[int] = Field(None, description="总出库仓库ID（若提供则覆盖表头和明细未指定者）")
    warehouse_name: Optional[str] = Field(None, description="出库仓库名称")
    delivery_time: Optional[datetime] = Field(None, description="出库时间")
    notes: Optional[str] = Field(None, description="确认备注")
    items: Optional[List[OutboundConfirmationItem]] = Field(
        None,
        description="明细更新（可选，用于补全批号/库位/序列号等）",
    )
