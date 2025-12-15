"""
设备数据采集 Schema 模块

定义设备数据采集相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DeviceDataCollectionBase(BaseModel):
    """设备数据采集基础 Schema"""
    
    collection_no: str = Field(..., max_length=100, description="采集编号")
    collection_name: str = Field(..., max_length=200, description="采集名称")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    collection_point: Optional[str] = Field(None, max_length=200, description="采集点")
    collection_frequency: Optional[int] = Field(None, description="采集频率（秒）")
    collection_status: str = Field("运行中", max_length=50, description="采集状态")
    data_quality: str = Field("正常", max_length=50, description="数据质量")
    last_collection_time: Optional[datetime] = Field(None, description="最后采集时间")
    collection_count: int = Field(0, description="采集次数")
    error_count: int = Field(0, description="错误次数")
    status: str = Field("启用", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DeviceDataCollectionCreate(DeviceDataCollectionBase):
    """创建设备数据采集 Schema"""
    pass


class DeviceDataCollectionUpdate(BaseModel):
    """更新设备数据采集 Schema"""
    
    collection_name: Optional[str] = Field(None, max_length=200, description="采集名称")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    collection_point: Optional[str] = Field(None, max_length=200, description="采集点")
    collection_frequency: Optional[int] = Field(None, description="采集频率（秒）")
    collection_status: Optional[str] = Field(None, max_length=50, description="采集状态")
    data_quality: Optional[str] = Field(None, max_length=50, description="数据质量")
    last_collection_time: Optional[datetime] = Field(None, description="最后采集时间")
    collection_count: Optional[int] = Field(None, description="采集次数")
    error_count: Optional[int] = Field(None, description="错误次数")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DeviceDataCollectionResponse(DeviceDataCollectionBase):
    """设备数据采集响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

