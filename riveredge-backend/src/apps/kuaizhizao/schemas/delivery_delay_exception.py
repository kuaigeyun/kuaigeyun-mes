"""
交期延期异常记录数据验证Schema模块

定义交期延期异常记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class DeliveryDelayExceptionBase(BaseModel):
    """
    交期延期异常记录基础Schema

    包含所有交期延期异常记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    planned_end_date: datetime = Field(..., description="计划结束日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    delay_days: int = Field(..., description="延期天数")
    delay_reason: Optional[str] = Field(None, description="延期原因")
    alert_level: str = Field("medium", description="预警级别")
    status: str = Field("pending", description="处理状态")
    suggested_action: Optional[str] = Field(None, description="建议操作")
    remarks: Optional[str] = Field(None, description="备注")


class DeliveryDelayExceptionCreate(DeliveryDelayExceptionBase):
    """
    交期延期异常记录创建Schema

    用于创建新交期延期异常记录的数据验证。
    """
    pass


class DeliveryDelayExceptionUpdate(BaseModel):
    """
    交期延期异常记录更新Schema

    用于更新交期延期异常记录的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    status: Optional[str] = Field(None, description="处理状态")
    suggested_action: Optional[str] = Field(None, description="建议操作")
    remarks: Optional[str] = Field(None, description="备注")


class DeliveryDelayExceptionResponse(DeliveryDelayExceptionBase):
    """
    交期延期异常记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="记录ID")
    uuid: str = Field(..., description="业务ID")
    handled_by: Optional[int] = Field(None, description="处理人ID")
    handled_by_name: Optional[str] = Field(None, description="处理人姓名")
    handled_at: Optional[datetime] = Field(None, description="处理时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class DeliveryDelayExceptionListResponse(DeliveryDelayExceptionResponse):
    """
    交期延期异常记录列表响应Schema

    用于交期延期异常记录列表API的响应数据格式。
    """
    pass

