"""
能源监测 Schema 模块

定义能源监测相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class EnergyMonitoringBase(BaseModel):
    """能源监测基础 Schema"""
    
    monitoring_no: str = Field(..., max_length=100, description="监测编号")
    monitoring_name: str = Field(..., max_length=200, description="监测名称")
    energy_type: str = Field(..., max_length=50, description="能源类型")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    collection_frequency: Optional[int] = Field(None, description="采集频率（秒）")
    current_consumption: Optional[Decimal] = Field(None, description="当前能耗")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    collection_status: str = Field("运行中", max_length=50, description="采集状态")
    data_quality: str = Field("正常", max_length=50, description="数据质量")
    last_collection_time: Optional[datetime] = Field(None, description="最后采集时间")
    alert_status: str = Field("正常", max_length=50, description="预警状态")
    status: str = Field("启用", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergyMonitoringCreate(EnergyMonitoringBase):
    """创建能源监测 Schema"""
    pass


class EnergyMonitoringUpdate(BaseModel):
    """更新能源监测 Schema"""
    
    monitoring_name: Optional[str] = Field(None, max_length=200, description="监测名称")
    energy_type: Optional[str] = Field(None, max_length=50, description="能源类型")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    collection_frequency: Optional[int] = Field(None, description="采集频率（秒）")
    current_consumption: Optional[Decimal] = Field(None, description="当前能耗")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    collection_status: Optional[str] = Field(None, max_length=50, description="采集状态")
    data_quality: Optional[str] = Field(None, max_length=50, description="数据质量")
    last_collection_time: Optional[datetime] = Field(None, description="最后采集时间")
    alert_status: Optional[str] = Field(None, max_length=50, description="预警状态")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergyMonitoringResponse(EnergyMonitoringBase):
    """能源监测响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

