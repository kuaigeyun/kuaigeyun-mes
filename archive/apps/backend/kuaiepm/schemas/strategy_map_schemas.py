"""
战略地图 Schema 模块

定义战略地图数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class StrategyMapBase(BaseModel):
    """战略地图基础 Schema"""
    
    map_no: str = Field(..., max_length=50, description="地图编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("map_no")
    def validate_map_no(cls, v):
        """验证地图编号格式"""
        if not v or not v.strip():
            raise ValueError("地图编号不能为空")
        return v.strip()


class StrategyMapCreate(StrategyMapBase):
    """创建战略地图 Schema"""
    pass


class StrategyMapUpdate(BaseModel):
    """更新战略地图 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class StrategyMapResponse(StrategyMapBase):
    """战略地图响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
