"""
传感器数据 Schema 模块

定义传感器数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SensorDataBase(BaseModel):
    """传感器数据基础 Schema"""
    
    data_no: str = Field(..., max_length=50, description="数据编号（组织内唯一）")
    status: str = Field("正常", max_length=50, description="状态")
    
    @validator("data_no")
    def validate_data_no(cls, v):
        """验证数据编号格式"""
        if not v or not v.strip():
            raise ValueError("数据编号不能为空")
        return v.strip()


class SensorDataCreate(SensorDataBase):
    """创建传感器数据 Schema"""
    pass


class SensorDataUpdate(BaseModel):
    """更新传感器数据 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class SensorDataResponse(SensorDataBase):
    """传感器数据响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

