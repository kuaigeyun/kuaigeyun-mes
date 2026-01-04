"""
报废记录数据验证Schema模块

定义报废记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class ScrapRecordBase(BaseModel):
    """
    报废记录基础Schema

    包含所有报废记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="报废单编码（可选，创建时自动生成）")
    reporting_record_id: Optional[int] = Field(None, description="报工记录ID（关联ReportingRecord）")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., description="工序编码")
    operation_name: str = Field(..., description="工序名称")
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    scrap_quantity: Decimal = Field(..., description="报废数量")
    unit_cost: Optional[Decimal] = Field(None, description="单位成本")
    total_cost: Decimal = Field(Decimal("0"), description="总成本")
    scrap_reason: str = Field(..., description="报废原因")
    scrap_type: str = Field("other", description="报废类型（process/material/quality/equipment/other）")
    warehouse_id: Optional[int] = Field(None, description="仓库ID（用于库存扣减）")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    status: str = Field("draft", description="状态（draft/confirmed/cancelled）")
    remarks: Optional[str] = Field(None, description="备注")


class ScrapRecordCreate(ScrapRecordBase):
    """
    报废记录创建Schema

    用于创建新报废记录的数据验证。
    """
    code: Optional[str] = Field(None, description="报废单编码（可选，如果不提供则自动生成）")


class ScrapRecordCreateFromReporting(BaseModel):
    """
    从报工记录创建报废记录请求Schema

    用于从报工记录创建报废记录的简化请求。
    """
    scrap_quantity: Decimal = Field(..., description="报废数量")
    scrap_reason: str = Field(..., description="报废原因")
    scrap_type: str = Field("other", description="报废类型（process/material/quality/equipment/other）")
    unit_cost: Optional[Decimal] = Field(None, description="单位成本")
    warehouse_id: Optional[int] = Field(None, description="仓库ID（用于库存扣减）")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    remarks: Optional[str] = Field(None, description="备注")


class ScrapRecordUpdate(BaseModel):
    """
    报废记录更新Schema

    用于更新报废记录的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    scrap_quantity: Optional[Decimal] = Field(None, description="报废数量")
    scrap_reason: Optional[str] = Field(None, description="报废原因")
    scrap_type: Optional[str] = Field(None, description="报废类型")
    unit_cost: Optional[Decimal] = Field(None, description="单位成本")
    total_cost: Optional[Decimal] = Field(None, description="总成本")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    warehouse_name: Optional[str] = Field(None, description="仓库名称")
    status: Optional[str] = Field(None, description="状态")
    remarks: Optional[str] = Field(None, description="备注")


class ScrapRecordResponse(ScrapRecordBase):
    """
    报废记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="报废记录ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    confirmed_at: Optional[datetime] = Field(None, description="确认时间")
    confirmed_by: Optional[int] = Field(None, description="确认人ID")
    confirmed_by_name: Optional[str] = Field(None, description="确认人姓名")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class ScrapRecordListResponse(BaseModel):
    """
    报废记录列表响应Schema

    用于报废记录列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="报废记录ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="报废单编码")
    work_order_code: str = Field(..., description="工单编码")
    operation_name: str = Field(..., description="工序名称")
    product_name: str = Field(..., description="产品名称")
    scrap_quantity: Decimal = Field(..., description="报废数量")
    unit_cost: Optional[Decimal] = Field(None, description="单位成本")
    total_cost: Decimal = Field(..., description="总成本")
    scrap_reason: str = Field(..., description="报废原因")
    scrap_type: str = Field(..., description="报废类型")
    status: str = Field(..., description="状态")
    created_at: datetime = Field(..., description="创建时间")

