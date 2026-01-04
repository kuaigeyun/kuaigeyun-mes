"""
仓储管理模块数据验证schema

提供仓储管理相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime
from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


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

    class Config:
        from_attributes = True


class ProductionPickingListResponse(ProductionPickingResponse):
    """生产领料单列表响应schema（简化版）"""
    pass


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

    class Config:
        from_attributes = True


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


# === 销售出库单 ===

class SalesDeliveryBase(BaseSchema):
    """销售出库单基础schema"""
    delivery_code: Optional[str] = Field(None, max_length=50, description="出库单编码（可选，如果不提供则自动生成）")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID（MTO模式，MTS模式可为空）")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码（MTO模式，MTS模式可为空）")
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

    class Config:
        from_attributes = True


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
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
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


# === 采购入库单 ===

class PurchaseReceiptBase(BaseSchema):
    """采购入库单基础schema"""
    receipt_code: str = Field(..., max_length=50, description="入库单编码")
    purchase_order_id: int = Field(..., description="采购订单ID")
    purchase_order_code: str = Field(..., max_length=50, description="采购订单编码")
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


# === 采购入库单明细 ===

class PurchaseReceiptItemBase(BaseSchema):
    """采购入库单明细基础schema"""
    purchase_order_item_id: int = Field(..., description="采购订单明细ID")
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
    location_id: Optional[int] = Field(None, description="库位ID")
    location_code: Optional[str] = Field(None, max_length=50, description="库位编码")
    batch_number: Optional[str] = Field(None, max_length=50, description="批次号")
    expiry_date: Optional[datetime] = Field(None, description="到期日期")
    manufacturing_date: Optional[datetime] = Field(None, description="生产日期")
    status: str = Field("待入库", max_length=20, description="入库状态")
    receipt_time: Optional[datetime] = Field(None, description="实际入库时间")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseReceiptItemCreate(PurchaseReceiptItemBase):
    """采购入库单明细创建schema"""
    pass


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

    class Config:
        from_attributes = True


# === 采购入库单（主表，需要在明细之后定义） ===

class PurchaseReceiptCreate(PurchaseReceiptBase):
    """采购入库单创建schema"""
    items: Optional[List[PurchaseReceiptItemCreate]] = Field(default_factory=list, description="入库单明细列表")


class PurchaseReceiptUpdate(PurchaseReceiptBase):
    """采购入库单更新schema"""
    receipt_code: Optional[str] = Field(None, max_length=50, description="入库单编码")


class PurchaseReceiptResponse(PurchaseReceiptBase):
    """采购入库单响应schema"""
    id: int = Field(..., description="入库单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True
