"""
传感器数据 Schema 模块

定义传感器数据相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class SensorDataBase(BaseModel):
    """传感器数据基础 Schema"""
    
    sensor_no: str = Field(..., max_length=100, description="传感器编号")
    sensor_name: str = Field(..., max_length=200, description="传感器名称")
    sensor_type: str = Field(..., max_length=50, description="传感器类型")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    collection_frequency: Optional[int] = Field(None, description="采集频率（秒）")
    parameter_config: Optional[Any] = Field(None, description="参数配置")
    last_collection_time: Optional[datetime] = Field(None, description="最后采集时间")
    collection_status: str = Field("运行中", max_length=50, description="采集状态")
    data_quality: str = Field("正常", max_length=50, description="数据质量")
    status: str = Field("启用", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SensorDataCreate(SensorDataBase):
    """创建传感器数据 Schema"""
    pass


class SensorDataUpdate(BaseModel):
    """更新传感器数据 Schema"""
    
    sensor_name: Optional[str] = Field(None, max_length=200, description="传感器名称")
    sensor_type: Optional[str] = Field(None, max_length=50, description="传感器类型")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    collection_frequency: Optional[int] = Field(None, description="采集频率（秒）")
    parameter_config: Optional[Any] = Field(None, description="参数配置")
    last_collection_time: Optional[datetime] = Field(None, description="最后采集时间")
    collection_status: Optional[str] = Field(None, max_length=50, description="采集状态")
    data_quality: Optional[str] = Field(None, max_length=50, description="数据质量")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SensorDataResponse(SensorDataBase):
    """传感器数据响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

