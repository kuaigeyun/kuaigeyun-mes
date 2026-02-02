"""
线边仓与倒冲记录 Schema 模块

定义线边仓库存、调拨、倒冲记录相关的 Pydantic Schema。

Author: RiverEdge Team
Date: 2026-02-02
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


# === 线边仓库存 ===

class LineSideInventoryBase(BaseModel):
    """线边仓库存基础 Schema"""
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: int = Field(..., description="线边仓ID")
    warehouse_name: Optional[str] = Field(None, description="线边仓名称")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    material_spec: Optional[str] = Field(None, description="规格型号")
    material_unit: Optional[str] = Field(None, description="单位")
    batch_no: Optional[str] = Field(None, description="批号")
    production_date: Optional[datetime] = Field(None, description="生产日期")
    expiry_date: Optional[datetime] = Field(None, description="有效期")
    quantity: Decimal = Field(default=0, description="库存数量")
    reserved_quantity: Decimal = Field(default=0, description="预留数量")
    work_order_id: Optional[int] = Field(None, description="关联工单ID")
    work_order_code: Optional[str] = Field(None, description="关联工单编码")
    source_type: Optional[str] = Field(None, description="来源类型")
    source_doc_id: Optional[int] = Field(None, description="来源单据ID")
    source_doc_code: Optional[str] = Field(None, description="来源单据编码")
    status: str = Field(default="available", description="状态")


class LineSideInventoryResponse(LineSideInventoryBase):
    """线边仓库存响应 Schema"""
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: Optional[int] = Field(None, description="组织ID")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")


class LineSideInventoryListResponse(BaseModel):
    """线边仓库存列表响应"""
    items: List[LineSideInventoryResponse] = Field(default_factory=list, description="库存列表")
    total: int = Field(..., description="总数")


# === 线边仓调拨入库 ===

class LineSideTransferInCreate(BaseModel):
    """线边仓调拨入库创建 Schema"""
    from_warehouse_id: int = Field(..., description="调出仓库ID（主仓库）")
    to_warehouse_id: int = Field(..., description="调入线边仓ID")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    batch_no: Optional[str] = Field(None, description="批号")
    quantity: Decimal = Field(..., description="调拨数量")
    work_order_id: Optional[int] = Field(None, description="预留工单ID")
    work_order_code: Optional[str] = Field(None, description="预留工单编码")


# === 倒冲记录 ===

class BackflushRecordBase(BaseModel):
    """倒冲记录基础 Schema"""
    model_config = ConfigDict(from_attributes=True)

    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    operation_id: Optional[int] = Field(None, description="工序单ID")
    operation_code: Optional[str] = Field(None, description="工序编码")
    report_id: int = Field(..., description="报工记录ID")
    report_quantity: Decimal = Field(..., description="报工数量")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    material_unit: Optional[str] = Field(None, description="单位")
    batch_no: Optional[str] = Field(None, description="批号")
    warehouse_id: int = Field(..., description="出库仓库ID")
    warehouse_name: Optional[str] = Field(None, description="出库仓库名称")
    warehouse_type: Optional[str] = Field(None, description="仓库类型")
    bom_quantity: Decimal = Field(..., description="BOM单位用量")
    backflush_quantity: Decimal = Field(..., description="倒冲数量")
    status: str = Field(..., description="状态")


class BackflushRecordResponse(BackflushRecordBase):
    """倒冲记录响应 Schema"""
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: Optional[int] = Field(None, description="组织ID")
    error_message: Optional[str] = Field(None, description="错误信息")
    processed_at: Optional[datetime] = Field(None, description="处理时间")
    processed_by: Optional[int] = Field(None, description="处理人ID")
    processed_by_name: Optional[str] = Field(None, description="处理人姓名")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")


class BackflushRecordListResponse(BaseModel):
    """倒冲记录列表响应"""
    items: List[BackflushRecordResponse] = Field(default_factory=list, description="倒冲记录列表")
    total: int = Field(..., description="总数")
