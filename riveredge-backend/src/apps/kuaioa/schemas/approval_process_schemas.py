"""
审批流程 Schema 模块

定义审批流程数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ApprovalProcessBase(BaseModel):
    """审批流程基础 Schema"""
    
    process_no: str = Field(..., max_length=50, description="流程编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("process_no")
    def validate_process_no(cls, v):
        """验证流程编号格式"""
        if not v or not v.strip():
            raise ValueError("流程编号不能为空")
        return v.strip()


class ApprovalProcessCreate(ApprovalProcessBase):
    """创建审批流程 Schema"""
    pass


class ApprovalProcessUpdate(BaseModel):
    """更新审批流程 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ApprovalProcessResponse(ApprovalProcessBase):
    """审批流程响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
