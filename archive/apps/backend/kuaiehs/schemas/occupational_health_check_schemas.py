"""
职业健康检查 Schema 模块

定义职业健康检查数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class OccupationalHealthCheckBase(BaseModel):
    """职业健康检查基础 Schema"""
    
    check_no: str = Field(..., max_length=50, description="检查编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("check_no")
    def validate_check_no(cls, v):
        """验证检查编号格式"""
        if not v or not v.strip():
            raise ValueError("检查编号不能为空")
        return v.strip()


class OccupationalHealthCheckCreate(OccupationalHealthCheckBase):
    """创建职业健康检查 Schema"""
    pass


class OccupationalHealthCheckUpdate(BaseModel):
    """更新职业健康检查 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class OccupationalHealthCheckResponse(OccupationalHealthCheckBase):
    """职业健康检查响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
