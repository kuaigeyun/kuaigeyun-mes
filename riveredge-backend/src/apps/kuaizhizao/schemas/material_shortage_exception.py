"""
缺料异常记录数据验证Schema模块

定义缺料异常记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class MaterialShortageExceptionBase(BaseModel):
    """
    缺料异常记录基础Schema

    包含所有缺料异常记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    shortage_quantity: Decimal = Field(..., description="缺料数量")
    available_quantity: Decimal = Field(..., description="可用数量")
    required_quantity: Decimal = Field(..., description="需求数量")
    alert_level: str = Field("medium", description="预警级别")
    status: str = Field("pending", description="处理状态")
    alternative_material_id: Optional[int] = Field(None, description="替代物料ID")
    alternative_material_code: Optional[str] = Field(None, description="替代物料编码")
    alternative_material_name: Optional[str] = Field(None, description="替代物料名称")
    suggested_action: Optional[str] = Field(None, description="建议操作")
    remarks: Optional[str] = Field(None, description="备注")


class MaterialShortageExceptionCreate(MaterialShortageExceptionBase):
    """
    缺料异常记录创建Schema

    用于创建新缺料异常记录的数据验证。
    """
    pass


class MaterialShortageExceptionUpdate(BaseModel):
    """
    缺料异常记录更新Schema

    用于更新缺料异常记录的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    status: Optional[str] = Field(None, description="处理状态")
    alternative_material_id: Optional[int] = Field(None, description="替代物料ID")
    alternative_material_code: Optional[str] = Field(None, description="替代物料编码")
    alternative_material_name: Optional[str] = Field(None, description="替代物料名称")
    suggested_action: Optional[str] = Field(None, description="建议操作")
    remarks: Optional[str] = Field(None, description="备注")


class MaterialShortageExceptionResponse(MaterialShortageExceptionBase):
    """
    缺料异常记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="记录ID")
    uuid: str = Field(..., description="业务ID")
    handled_by: Optional[int] = Field(None, description="处理人ID")
    handled_by_name: Optional[str] = Field(None, description="处理人姓名")
    handled_at: Optional[datetime] = Field(None, description="处理时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class MaterialShortageExceptionListResponse(MaterialShortageExceptionResponse):
    """
    缺料异常记录列表响应Schema

    用于缺料异常记录列表API的响应数据格式。
    """
    pass

