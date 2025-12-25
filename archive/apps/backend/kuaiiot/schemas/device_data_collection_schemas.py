"""
设备数据采集 Schema 模块

定义设备数据采集数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class DeviceDataCollectionBase(BaseModel):
    """设备数据采集基础 Schema"""
    
    collection_no: str = Field(..., max_length=50, description="采集编号（组织内唯一）")
    status: str = Field("启用", max_length=50, description="状态")
    
    @validator("collection_no")
    def validate_collection_no(cls, v):
        """验证采集编号格式"""
        if not v or not v.strip():
            raise ValueError("采集编号不能为空")
        return v.strip()


class DeviceDataCollectionCreate(DeviceDataCollectionBase):
    """创建设备数据采集 Schema"""
    pass


class DeviceDataCollectionUpdate(BaseModel):
    """更新设备数据采集 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class DeviceDataCollectionResponse(DeviceDataCollectionBase):
    """设备数据采集响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

