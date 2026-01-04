"""
装箱打包绑定记录数据验证Schema模块

定义装箱打包绑定记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class PackingBindingBase(BaseModel):
    """
    装箱打包绑定记录基础Schema

    包含所有装箱打包绑定记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    finished_goods_receipt_id: int = Field(..., description="成品入库单ID（关联FinishedGoodsReceipt）")
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    product_serial_no: Optional[str] = Field(None, description="产品序列号（可选）")
    packing_material_id: Optional[int] = Field(None, description="包装物料ID（可选）")
    packing_material_code: Optional[str] = Field(None, description="包装物料编码（可选）")
    packing_material_name: Optional[str] = Field(None, description="包装物料名称（可选）")
    packing_quantity: Decimal = Field(..., gt=0, description="装箱数量")
    box_no: Optional[str] = Field(None, description="箱号（可选）")
    binding_method: str = Field("manual", description="绑定方式（scan/manual）")
    barcode: Optional[str] = Field(None, description="条码（可选，用于扫码绑定）")
    bound_at: datetime = Field(default_factory=datetime.now, description="绑定时间")
    remarks: Optional[str] = Field(None, description="备注")


class PackingBindingCreate(PackingBindingBase):
    """
    装箱打包绑定记录创建Schema

    用于创建新装箱打包绑定记录的数据验证。
    """
    pass


class PackingBindingCreateFromReceipt(BaseModel):
    """
    从成品入库单创建装箱绑定记录请求Schema

    用于从成品入库单创建装箱绑定记录的简化请求。
    """
    product_id: int = Field(..., description="产品ID")
    product_code: Optional[str] = Field(None, description="产品编码（可选）")
    product_name: Optional[str] = Field(None, description="产品名称（可选）")
    product_serial_no: Optional[str] = Field(None, description="产品序列号（可选）")
    packing_material_id: Optional[int] = Field(None, description="包装物料ID（可选）")
    packing_material_code: Optional[str] = Field(None, description="包装物料编码（可选）")
    packing_material_name: Optional[str] = Field(None, description="包装物料名称（可选）")
    packing_quantity: Decimal = Field(..., gt=0, description="装箱数量")
    box_no: Optional[str] = Field(None, description="箱号（可选）")
    binding_method: str = Field("manual", description="绑定方式（scan/manual）")
    barcode: Optional[str] = Field(None, description="条码（可选，用于扫码绑定）")
    remarks: Optional[str] = Field(None, description="备注")


class PackingBindingUpdate(BaseModel):
    """
    装箱打包绑定记录更新Schema

    用于更新装箱打包绑定记录的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    packing_quantity: Optional[Decimal] = Field(None, gt=0, description="装箱数量")
    box_no: Optional[str] = Field(None, description="箱号")
    remarks: Optional[str] = Field(None, description="备注")


class PackingBindingResponse(PackingBindingBase):
    """
    装箱打包绑定记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="装箱绑定记录ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    bound_by: int = Field(..., description="绑定人ID")
    bound_by_name: str = Field(..., description="绑定人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class PackingBindingListResponse(BaseModel):
    """
    装箱打包绑定记录列表响应Schema

    用于装箱打包绑定记录列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="装箱绑定记录ID")
    uuid: str = Field(..., description="业务ID")
    finished_goods_receipt_id: int = Field(..., description="成品入库单ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    product_serial_no: Optional[str] = Field(None, description="产品序列号")
    packing_material_code: Optional[str] = Field(None, description="包装物料编码")
    packing_material_name: Optional[str] = Field(None, description="包装物料名称")
    packing_quantity: Decimal = Field(..., description="装箱数量")
    box_no: Optional[str] = Field(None, description="箱号")
    binding_method: str = Field(..., description="绑定方式")
    bound_by_name: str = Field(..., description="绑定人姓名")
    bound_at: datetime = Field(..., description="绑定时间")
    created_at: datetime = Field(..., description="创建时间")

