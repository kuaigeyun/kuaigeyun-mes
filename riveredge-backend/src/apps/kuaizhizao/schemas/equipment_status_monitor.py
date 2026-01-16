"""
设备状态监控 Schema 模块

定义设备状态监控相关的 Pydantic Schema。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class EquipmentStatusMonitorBase(BaseModel):
    """
    设备状态监控基础 Schema
    """
    equipment_uuid: str = Field(..., max_length=36, description="设备UUID")
    status: str = Field(default="正常", max_length=50, description="设备状态")
    is_online: bool = Field(default=False, description="是否在线")
    runtime_hours: Optional[Decimal] = Field(None, description="运行时长（小时）")
    last_maintenance_date: Optional[datetime] = Field(None, description="上次维护日期")
    next_maintenance_date: Optional[datetime] = Field(None, description="下次维护日期")
    temperature: Optional[Decimal] = Field(None, description="温度（摄氏度）")
    pressure: Optional[Decimal] = Field(None, description="压力")
    vibration: Optional[Decimal] = Field(None, description="振动值")
    other_parameters: Optional[Dict[str, Any]] = Field(None, description="其他参数（JSON格式）")
    data_source: str = Field(default="manual", max_length=50, description="数据来源（manual/SCADA/sensor）")
    monitored_at: datetime = Field(..., description="监控时间")


class EquipmentStatusMonitorCreate(EquipmentStatusMonitorBase):
    """
    创建设备状态监控记录 Schema
    """
    pass


class EquipmentStatusMonitorUpdate(BaseModel):
    """
    更新设备状态监控记录 Schema
    """
    status: Optional[str] = Field(None, max_length=50, description="设备状态")
    is_online: Optional[bool] = Field(None, description="是否在线")
    runtime_hours: Optional[Decimal] = Field(None, description="运行时长（小时）")
    last_maintenance_date: Optional[datetime] = Field(None, description="上次维护日期")
    next_maintenance_date: Optional[datetime] = Field(None, description="下次维护日期")
    temperature: Optional[Decimal] = Field(None, description="温度（摄氏度）")
    pressure: Optional[Decimal] = Field(None, description="压力")
    vibration: Optional[Decimal] = Field(None, description="振动值")
    other_parameters: Optional[Dict[str, Any]] = Field(None, description="其他参数（JSON格式）")
    data_source: Optional[str] = Field(None, max_length=50, description="数据来源")
    monitored_at: Optional[datetime] = Field(None, description="监控时间")


class EquipmentStatusMonitorResponse(EquipmentStatusMonitorBase):
    """
    设备状态监控响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    uuid: str = Field(..., description="监控记录UUID")
    id: int = Field(..., description="监控记录ID")
    tenant_id: int = Field(..., description="组织ID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_code: str = Field(..., description="设备编码")
    equipment_name: str = Field(..., description="设备名称")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class EquipmentStatusMonitorListResponse(BaseModel):
    """
    设备状态监控列表响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    items: list[EquipmentStatusMonitorResponse] = Field(..., description="监控记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


class EquipmentStatusHistoryResponse(BaseModel):
    """
    设备状态历史响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    uuid: str = Field(..., description="历史记录UUID")
    id: int = Field(..., description="历史记录ID")
    tenant_id: int = Field(..., description="组织ID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_uuid: str = Field(..., description="设备UUID")
    from_status: Optional[str] = Field(None, description="原状态")
    to_status: str = Field(..., description="新状态")
    status_changed_at: datetime = Field(..., description="状态变更时间")
    changed_by: Optional[int] = Field(None, description="变更人ID")
    changed_by_name: Optional[str] = Field(None, description="变更人姓名")
    reason: Optional[str] = Field(None, description="变更原因")
    remark: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class EquipmentStatusHistoryListResponse(BaseModel):
    """
    设备状态历史列表响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    items: list[EquipmentStatusHistoryResponse] = Field(..., description="历史记录列表")
    total: int = Field(..., description="总数量")


class EquipmentStatusUpdateRequest(BaseModel):
    """
    设备状态更新请求 Schema

    用于手动更新设备状态的请求。
    """
    equipment_uuid: str = Field(..., max_length=36, description="设备UUID")
    status: str = Field(..., max_length=50, description="设备状态")
    is_online: Optional[bool] = Field(None, description="是否在线")
    reason: Optional[str] = Field(None, max_length=200, description="变更原因")
    remark: Optional[str] = Field(None, description="备注")
