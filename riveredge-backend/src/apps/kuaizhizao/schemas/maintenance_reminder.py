"""
设备维护提醒 Schema 模块

定义设备维护提醒相关的 Pydantic Schema。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class MaintenanceReminderBase(BaseModel):
    """
    设备维护提醒基础 Schema
    """
    maintenance_plan_uuid: Optional[str] = Field(None, max_length=36, description="维护计划UUID")
    equipment_uuid: str = Field(..., max_length=36, description="设备UUID")
    reminder_type: str = Field(..., max_length=50, description="提醒类型（due_soon/overdue）")
    reminder_message: Optional[str] = Field(None, description="提醒消息")


class MaintenanceReminderResponse(BaseModel):
    """
    设备维护提醒响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    uuid: str = Field(..., description="提醒记录UUID")
    id: int = Field(..., description="提醒记录ID")
    tenant_id: int = Field(..., description="组织ID")
    maintenance_plan_id: Optional[int] = Field(None, description="维护计划ID")
    maintenance_plan_uuid: Optional[str] = Field(None, description="维护计划UUID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_uuid: str = Field(..., description="设备UUID")
    equipment_code: str = Field(..., description="设备编码")
    equipment_name: str = Field(..., description="设备名称")
    reminder_type: str = Field(..., description="提醒类型")
    reminder_date: datetime = Field(..., description="提醒日期")
    planned_maintenance_date: datetime = Field(..., description="计划维护日期")
    days_until_due: int = Field(..., description="距离到期天数")
    reminder_message: Optional[str] = Field(None, description="提醒消息")
    is_read: bool = Field(default=False, description="是否已读")
    read_at: Optional[datetime] = Field(None, description="已读时间")
    read_by: Optional[int] = Field(None, description="已读人ID")
    is_handled: bool = Field(default=False, description="是否已处理")
    handled_at: Optional[datetime] = Field(None, description="处理时间")
    handled_by: Optional[int] = Field(None, description="处理人ID")
    handled_by_name: Optional[str] = Field(None, description="处理人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class MaintenanceReminderListResponse(BaseModel):
    """
    设备维护提醒列表响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    items: list[MaintenanceReminderResponse] = Field(..., description="提醒记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")
    unread_count: int = Field(default=0, description="未读提醒数量")


class MaintenanceReminderMarkReadRequest(BaseModel):
    """
    标记提醒为已读请求 Schema
    """
    reminder_uuids: list[str] = Field(..., description="提醒UUID列表")


class MaintenanceReminderMarkHandledRequest(BaseModel):
    """
    标记提醒为已处理请求 Schema
    """
    reminder_uuid: str = Field(..., max_length=36, description="提醒UUID")
    remark: Optional[str] = Field(None, description="处理备注")
