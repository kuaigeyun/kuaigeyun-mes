"""
委外工单数据验证Schema模块

定义委外工单相关的Pydantic数据验证Schema。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class OutsourceWorkOrderBase(BaseModel):
    """
    委外工单基础Schema

    包含所有委外工单的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="委外工单编码（可选，创建时自动生成）")
    name: Optional[str] = Field(None, description="委外工单名称（可选）")
    product_id: int = Field(..., description="产品ID（关联物料，物料来源类型必须为Outsource）")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    quantity: Decimal = Field(..., description="计划委外数量")
    supplier_id: int = Field(..., description="委外供应商ID")
    supplier_code: str = Field(..., description="委外供应商编码")
    supplier_name: str = Field(..., description="委外供应商名称")
    outsource_operation: Optional[str] = Field(None, description="委外工序")
    unit_price: Optional[Decimal] = Field(None, description="委外单价")
    total_amount: Decimal = Field(Decimal("0"), description="委外总金额")
    status: str = Field("draft", description="委外工单状态")
    priority: str = Field("normal", description="优先级")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceWorkOrderCreate(OutsourceWorkOrderBase):
    """创建委外工单 Schema"""
    pass


class OutsourceWorkOrderUpdate(BaseModel):
    """更新委外工单 Schema"""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="委外工单名称")
    quantity: Optional[Decimal] = Field(None, description="计划委外数量")
    unit_price: Optional[Decimal] = Field(None, description="委外单价")
    total_amount: Optional[Decimal] = Field(None, description="委外总金额")
    status: Optional[str] = Field(None, description="委外工单状态")
    priority: Optional[str] = Field(None, description="优先级")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束时间")
    received_quantity: Optional[Decimal] = Field(None, description="已收货数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    unqualified_quantity: Optional[Decimal] = Field(None, description="不合格数量")
    issued_quantity: Optional[Decimal] = Field(None, description="已发料数量")
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceWorkOrderResponse(OutsourceWorkOrderBase):
    """委外工单响应 Schema"""
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="组织ID")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束时间")
    received_quantity: Decimal = Field(Decimal("0"), description="已收货数量")
    qualified_quantity: Decimal = Field(Decimal("0"), description="合格数量")
    unqualified_quantity: Decimal = Field(Decimal("0"), description="不合格数量")
    issued_quantity: Decimal = Field(Decimal("0"), description="已发料数量")
    is_frozen: bool = Field(False, alias="isFrozen", description="是否冻结")
    freeze_reason: Optional[str] = Field(None, alias="freezeReason", description="冻结原因")
    frozen_at: Optional[datetime] = Field(None, alias="frozenAt", description="冻结时间")
    frozen_by: Optional[int] = Field(None, alias="frozenBy", description="冻结人ID")
    frozen_by_name: Optional[str] = Field(None, alias="frozenByName", description="冻结人姓名")
    created_by: int = Field(..., alias="createdBy", description="创建人ID")
    created_by_name: str = Field(..., alias="createdByName", description="创建人姓名")
    updated_by: Optional[int] = Field(None, alias="updatedBy", description="更新人ID")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")


class OutsourceWorkOrderListResponse(BaseModel):
    """委外工单列表响应 Schema"""
    data: List[OutsourceWorkOrderResponse] = Field(..., description="委外工单列表")
    total: int = Field(..., description="总数")
    success: bool = Field(True, description="是否成功")


# ==================== 委外发料 Schema ====================

class OutsourceMaterialIssueBase(BaseModel):
    """委外发料基础Schema"""
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="委外发料单编码（可选，创建时自动生成）")
    outsource_work_order_id: int = Field(..., description="委外工单ID")
    outsource_work_order_code: str = Field(..., description="委外工单编码")
    material_id: int = Field(..., description="物料ID（原材料）")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    quantity: Decimal = Field(..., description="发料数量")
    unit: str = Field(..., description="单位")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID（可选）")
    location_name: Optional[str] = Field(None, description="库位名称（可选）")
    batch_number: Optional[str] = Field(None, description="批次号（可选）")
    status: str = Field("draft", description="状态")
    issued_at: Optional[datetime] = Field(None, description="发料时间")
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceMaterialIssueCreate(OutsourceMaterialIssueBase):
    """创建委外发料 Schema"""
    pass


class OutsourceMaterialIssueUpdate(BaseModel):
    """更新委外发料 Schema"""
    model_config = ConfigDict(from_attributes=True)

    quantity: Optional[Decimal] = Field(None, description="发料数量")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_name: Optional[str] = Field(None, description="库位名称")
    batch_number: Optional[str] = Field(None, description="批次号")
    status: Optional[str] = Field(None, description="状态")
    issued_at: Optional[datetime] = Field(None, description="发料时间")
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceMaterialIssueResponse(OutsourceMaterialIssueBase):
    """委外发料响应 Schema"""
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="组织ID")
    issued_by: Optional[int] = Field(None, alias="issuedBy", description="发料人ID")
    issued_by_name: Optional[str] = Field(None, alias="issuedByName", description="发料人姓名")
    created_by: int = Field(..., alias="createdBy", description="创建人ID")
    created_by_name: str = Field(..., alias="createdByName", description="创建人姓名")
    updated_by: Optional[int] = Field(None, alias="updatedBy", description="更新人ID")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")


# ==================== 委外收货 Schema ====================

class OutsourceMaterialReceiptBase(BaseModel):
    """委外收货基础Schema"""
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="委外收货单编码（可选，创建时自动生成）")
    outsource_work_order_id: int = Field(..., description="委外工单ID")
    outsource_work_order_code: str = Field(..., description="委外工单编码")
    quantity: Decimal = Field(..., description="收货数量")
    qualified_quantity: Decimal = Field(Decimal("0"), description="合格数量")
    unqualified_quantity: Decimal = Field(Decimal("0"), description="不合格数量")
    unit: str = Field(..., description="单位")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID（可选）")
    location_name: Optional[str] = Field(None, description="库位名称（可选）")
    batch_number: Optional[str] = Field(None, description="批次号（可选）")
    status: str = Field("draft", description="状态")
    received_at: Optional[datetime] = Field(None, description="收货时间")
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceMaterialReceiptCreate(OutsourceMaterialReceiptBase):
    """创建委外收货 Schema"""
    pass


class OutsourceMaterialReceiptUpdate(BaseModel):
    """更新委外收货 Schema"""
    model_config = ConfigDict(from_attributes=True)

    quantity: Optional[Decimal] = Field(None, description="收货数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    unqualified_quantity: Optional[Decimal] = Field(None, description="不合格数量")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID")
    location_name: Optional[str] = Field(None, description="库位名称")
    batch_number: Optional[str] = Field(None, description="批次号")
    status: Optional[str] = Field(None, description="状态")
    received_at: Optional[datetime] = Field(None, description="收货时间")
    remarks: Optional[str] = Field(None, description="备注")


class OutsourceMaterialReceiptResponse(OutsourceMaterialReceiptBase):
    """委外收货响应 Schema"""
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="组织ID")
    received_by: Optional[int] = Field(None, alias="receivedBy", description="收货人ID")
    received_by_name: Optional[str] = Field(None, alias="receivedByName", description="收货人姓名")
    created_by: int = Field(..., alias="createdBy", description="创建人ID")
    created_by_name: str = Field(..., alias="createdByName", description="创建人姓名")
    updated_by: Optional[int] = Field(None, alias="updatedBy", description="更新人ID")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
