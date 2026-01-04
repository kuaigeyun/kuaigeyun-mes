"""
物料绑定记录数据验证Schema模块

定义物料绑定记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class MaterialBindingBase(BaseModel):
    """
    物料绑定记录基础Schema

    包含所有物料绑定记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    reporting_record_id: int = Field(..., description="报工记录ID（关联ReportingRecord）")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., description="工序编码")
    operation_name: str = Field(..., description="工序名称")
    binding_type: str = Field(..., description="绑定类型（feeding/discharging）")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    quantity: Decimal = Field(..., gt=0, description="绑定数量")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    location_id: Optional[int] = Field(None, description="库位ID（可选）")
    location_code: Optional[str] = Field(None, description="库位编码（可选）")
    batch_no: Optional[str] = Field(None, description="批次号（可选）")
    barcode: Optional[str] = Field(None, description="条码（可选，用于扫码绑定）")
    binding_method: str = Field("manual", description="绑定方式（scan/manual）")
    bound_at: datetime = Field(default_factory=datetime.now, description="绑定时间")
    remarks: Optional[str] = Field(None, description="备注")


class MaterialBindingCreate(MaterialBindingBase):
    """
    物料绑定记录创建Schema

    用于创建新物料绑定记录的数据验证。
    """
    pass


class MaterialBindingCreateFromReporting(BaseModel):
    """
    从报工记录创建物料绑定记录请求Schema

    用于从报工记录创建物料绑定记录的简化请求。
    """
    binding_type: str = Field(..., description="绑定类型（feeding/discharging）")
    material_id: int = Field(..., description="物料ID")
    material_code: Optional[str] = Field(None, description="物料编码（可选，如果提供则使用，否则自动获取）")
    material_name: Optional[str] = Field(None, description="物料名称（可选，如果提供则使用，否则自动获取）")
    quantity: Decimal = Field(..., gt=0, description="绑定数量")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称（可选）")
    location_id: Optional[int] = Field(None, description="库位ID（可选）")
    location_code: Optional[str] = Field(None, description="库位编码（可选）")
    batch_no: Optional[str] = Field(None, description="批次号（可选）")
    barcode: Optional[str] = Field(None, description="条码（可选，用于扫码绑定）")
    binding_method: str = Field("manual", description="绑定方式（scan/manual）")
    remarks: Optional[str] = Field(None, description="备注")


class MaterialBindingUpdate(BaseModel):
    """
    物料绑定记录更新Schema

    用于更新物料绑定记录的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    quantity: Optional[Decimal] = Field(None, gt=0, description="绑定数量")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    location_id: Optional[int] = Field(None, description="库位ID")
    batch_no: Optional[str] = Field(None, description="批次号")
    remarks: Optional[str] = Field(None, description="备注")


class MaterialBindingResponse(MaterialBindingBase):
    """
    物料绑定记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="物料绑定记录ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    bound_by: int = Field(..., description="绑定人ID")
    bound_by_name: str = Field(..., description="绑定人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class MaterialBindingListResponse(BaseModel):
    """
    物料绑定记录列表响应Schema

    用于物料绑定记录列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="物料绑定记录ID")
    uuid: str = Field(..., description="业务ID")
    reporting_record_id: int = Field(..., description="报工记录ID")
    work_order_code: str = Field(..., description="工单编码")
    operation_name: str = Field(..., description="工序名称")
    binding_type: str = Field(..., description="绑定类型")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    quantity: Decimal = Field(..., description="绑定数量")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    binding_method: str = Field(..., description="绑定方式")
    bound_by_name: str = Field(..., description="绑定人姓名")
    bound_at: datetime = Field(..., description="绑定时间")
    created_at: datetime = Field(..., description="创建时间")

