"""
审批实例 Schema 模块

定义审批实例数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ApprovalInstanceBase(BaseModel):
    """审批实例基础 Schema"""
    
    instance_no: str = Field(..., max_length=50, description="实例编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("instance_no")
    def validate_instance_no(cls, v):
        """验证实例编号格式"""
        if not v or not v.strip():
            raise ValueError("实例编号不能为空")
        return v.strip()


class ApprovalInstanceCreate(ApprovalInstanceBase):
    """创建审批实例 Schema"""
    pass


class ApprovalInstanceUpdate(BaseModel):
    """更新审批实例 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ApprovalInstanceResponse(ApprovalInstanceBase):
    """审批实例响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
