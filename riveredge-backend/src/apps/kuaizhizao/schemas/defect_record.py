"""
不良品记录数据验证Schema模块

定义不良品记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class DefectRecordBase(BaseModel):
    """
    不良品记录基础Schema

    包含所有不良品记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="不良品记录编码（可选，创建时自动生成）")
    reporting_record_id: Optional[int] = Field(None, description="报工记录ID（关联ReportingRecord）")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., description="工序编码")
    operation_name: str = Field(..., description="工序名称")
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    defect_quantity: Decimal = Field(..., description="不良品数量")
    defect_type: str = Field("other", description="不良品类型（dimension/appearance/function/material/other）")
    defect_reason: str = Field(..., description="不良品原因")
    disposition: str = Field("quarantine", description="处理方式（quarantine/rework/scrap/accept/other）")
    quarantine_location: Optional[str] = Field(None, description="隔离位置（当处理方式为隔离时使用）")
    rework_order_id: Optional[int] = Field(None, description="返工单ID（当处理方式为返工时关联）")
    scrap_record_id: Optional[int] = Field(None, description="报废记录ID（当处理方式为报废时关联）")
    status: str = Field("draft", description="状态（draft/processed/cancelled）")
    remarks: Optional[str] = Field(None, description="备注")


class DefectRecordCreate(DefectRecordBase):
    """
    不良品记录创建Schema

    用于创建新不良品记录的数据验证。
    """
    code: Optional[str] = Field(None, description="不良品记录编码（可选，如果不提供则自动生成）")


class DefectRecordCreateFromReporting(BaseModel):
    """
    从报工记录创建不良品记录请求Schema

    用于从报工记录创建不良品记录的简化请求。
    """
    defect_quantity: Decimal = Field(..., description="不良品数量")
    defect_type: str = Field("other", description="不良品类型（dimension/appearance/function/material/other）")
    defect_reason: str = Field(..., description="不良品原因")
    disposition: str = Field("quarantine", description="处理方式（quarantine/rework/scrap/accept/other）")
    quarantine_location: Optional[str] = Field(None, description="隔离位置（当处理方式为隔离时使用）")
    remarks: Optional[str] = Field(None, description="备注")


class DefectRecordUpdate(BaseModel):
    """
    不良品记录更新Schema

    用于更新不良品记录的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    defect_quantity: Optional[Decimal] = Field(None, description="不良品数量")
    defect_type: Optional[str] = Field(None, description="不良品类型")
    defect_reason: Optional[str] = Field(None, description="不良品原因")
    disposition: Optional[str] = Field(None, description="处理方式")
    quarantine_location: Optional[str] = Field(None, description="隔离位置")
    rework_order_id: Optional[int] = Field(None, description="返工单ID")
    scrap_record_id: Optional[int] = Field(None, description="报废记录ID")
    status: Optional[str] = Field(None, description="状态")
    remarks: Optional[str] = Field(None, description="备注")


class DefectRecordResponse(DefectRecordBase):
    """
    不良品记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="不良品记录ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    processed_at: Optional[datetime] = Field(None, description="处理时间")
    processed_by: Optional[int] = Field(None, description="处理人ID")
    processed_by_name: Optional[str] = Field(None, description="处理人姓名")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class DefectRecordListResponse(BaseModel):
    """
    不良品记录列表响应Schema

    用于不良品记录列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="不良品记录ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="不良品记录编码")
    work_order_code: str = Field(..., description="工单编码")
    operation_name: str = Field(..., description="工序名称")
    product_name: str = Field(..., description="产品名称")
    defect_quantity: Decimal = Field(..., description="不良品数量")
    defect_type: str = Field(..., description="不良品类型")
    defect_reason: str = Field(..., description="不良品原因")
    disposition: str = Field(..., description="处理方式")
    status: str = Field(..., description="状态")
    created_at: datetime = Field(..., description="创建时间")

