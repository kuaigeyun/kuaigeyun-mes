"""
补货建议数据验证Schema模块

定义补货建议相关的Pydantic数据验证Schema。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class ReplenishmentSuggestionBase(BaseModel):
    """
    补货建议基础Schema

    包含所有补货建议的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., description="仓库名称")
    current_quantity: Decimal = Field(..., description="当前库存数量")
    safety_stock: Optional[Decimal] = Field(None, description="安全库存")
    min_stock: Optional[Decimal] = Field(None, description="最低库存")
    max_stock: Optional[Decimal] = Field(None, description="最高库存")
    suggested_quantity: Decimal = Field(..., description="建议补货数量")
    priority: str = Field("medium", description="优先级（high/medium/low）")
    suggestion_type: str = Field("low_stock", description="建议类型（low_stock/demand_based/seasonal）")
    estimated_delivery_days: Optional[int] = Field(None, description="预计交货天数")
    suggested_order_date: Optional[datetime] = Field(None, description="建议下单日期")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, description="供应商名称")
    alert_id: Optional[int] = Field(None, description="关联的预警ID")
    related_demand_id: Optional[int] = Field(None, description="关联的需求ID")
    related_demand_code: Optional[str] = Field(None, description="关联的需求编码")
    remarks: Optional[str] = Field(None, description="备注")


class ReplenishmentSuggestionResponse(ReplenishmentSuggestionBase):
    """
    补货建议响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="补货建议ID")
    uuid: str = Field(..., description="业务ID")
    status: str = Field(..., description="状态")
    processed_by: Optional[int] = Field(None, description="处理人ID")
    processed_by_name: Optional[str] = Field(None, description="处理人姓名")
    processed_at: Optional[datetime] = Field(None, description="处理时间")
    processing_notes: Optional[str] = Field(None, description="处理备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class ReplenishmentSuggestionListResponse(ReplenishmentSuggestionResponse):
    """
    补货建议列表响应Schema

    用于补货建议列表API的响应数据格式。
    """
    pass


class ReplenishmentSuggestionProcessRequest(BaseModel):
    """
    补货建议处理请求Schema

    用于处理补货建议的请求数据。
    """
    status: str = Field(..., description="处理状态（processed/ignored）")
    processing_notes: Optional[str] = Field(None, description="处理备注")
