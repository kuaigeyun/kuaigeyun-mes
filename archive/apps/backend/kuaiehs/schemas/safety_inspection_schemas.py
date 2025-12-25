"""
安全检查 Schema 模块

定义安全检查数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SafetyInspectionBase(BaseModel):
    """安全检查基础 Schema"""
    
    inspection_no: str = Field(..., max_length=50, description="检查编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("inspection_no")
    def validate_inspection_no(cls, v):
        """验证检查编号格式"""
        if not v or not v.strip():
            raise ValueError("检查编号不能为空")
        return v.strip()


class SafetyInspectionCreate(SafetyInspectionBase):
    """创建安全检查 Schema"""
    pass


class SafetyInspectionUpdate(BaseModel):
    """更新安全检查 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class SafetyInspectionResponse(SafetyInspectionBase):
    """安全检查响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
