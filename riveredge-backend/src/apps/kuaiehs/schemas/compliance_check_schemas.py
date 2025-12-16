"""
合规检查 Schema 模块

定义合规检查数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ComplianceCheckBase(BaseModel):
    """合规检查基础 Schema"""
    
    check_no: str = Field(..., max_length=50, description="检查编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("check_no")
    def validate_check_no(cls, v):
        """验证检查编号格式"""
        if not v or not v.strip():
            raise ValueError("检查编号不能为空")
        return v.strip()


class ComplianceCheckCreate(ComplianceCheckBase):
    """创建合规检查 Schema"""
    pass


class ComplianceCheckUpdate(BaseModel):
    """更新合规检查 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ComplianceCheckResponse(ComplianceCheckBase):
    """合规检查响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
