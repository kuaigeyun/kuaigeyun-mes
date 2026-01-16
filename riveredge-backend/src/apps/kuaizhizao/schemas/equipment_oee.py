"""
设备OEE统计 Schema 模块

定义设备OEE统计相关的 Pydantic Schema。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class EquipmentOEEBase(BaseModel):
    """
    设备OEE基础 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    equipment: Dict[str, Any] = Field(..., description="设备信息")
    period: Dict[str, str] = Field(..., description="统计周期")
    metrics: Dict[str, float] = Field(..., description="指标数据")
    oee: Dict[str, float] = Field(..., description="OEE指标")
    record_count: int = Field(..., description="报工记录数")


class EquipmentOEResponse(EquipmentOEEBase):
    """
    设备OEE响应 Schema

    用于API响应的数据格式。
    """
    pass


class EquipmentOEEListResponse(BaseModel):
    """
    设备OEE列表响应 Schema

    用于设备OEE列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    items: List[EquipmentOEResponse] = Field(default_factory=list, description="OEE统计列表")
    total: int = Field(0, description="总数量")


class EquipmentOEETrendResponse(BaseModel):
    """
    设备OEE趋势响应 Schema

    用于OEE趋势数据的响应格式。
    """
    model_config = ConfigDict(from_attributes=True)

    equipment_id: int = Field(..., description="设备ID")
    period_type: str = Field(..., description="统计周期类型（day/week/month）")
    trend_data: List[Dict[str, Any]] = Field(default_factory=list, description="趋势数据")
