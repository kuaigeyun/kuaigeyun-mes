"""
实时监控 Schema 模块

定义实时监控相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class RealTimeMonitoringBase(BaseModel):
    """实时监控基础 Schema"""
    
    monitoring_no: str = Field(..., max_length=100, description="监控编号")
    monitoring_name: str = Field(..., max_length=200, description="监控名称")
    monitoring_type: str = Field(..., max_length=50, description="监控类型")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    monitoring_config: Optional[Any] = Field(None, description="监控配置")
    alert_rules: Optional[Any] = Field(None, description="预警规则")
    current_status: Optional[str] = Field(None, max_length=50, description="当前状态")
    alert_status: str = Field("正常", max_length=50, description="预警状态")
    last_update_time: Optional[datetime] = Field(None, description="最后更新时间")
    status: str = Field("启用", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class RealTimeMonitoringCreate(RealTimeMonitoringBase):
    """创建实时监控 Schema"""
    pass


class RealTimeMonitoringUpdate(BaseModel):
    """更新实时监控 Schema"""
    
    monitoring_name: Optional[str] = Field(None, max_length=200, description="监控名称")
    monitoring_type: Optional[str] = Field(None, max_length=50, description="监控类型")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    monitoring_config: Optional[Any] = Field(None, description="监控配置")
    alert_rules: Optional[Any] = Field(None, description="预警规则")
    current_status: Optional[str] = Field(None, max_length=50, description="当前状态")
    alert_status: Optional[str] = Field(None, max_length=50, description="预警状态")
    last_update_time: Optional[datetime] = Field(None, description="最后更新时间")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class RealTimeMonitoringResponse(RealTimeMonitoringBase):
    """实时监控响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

