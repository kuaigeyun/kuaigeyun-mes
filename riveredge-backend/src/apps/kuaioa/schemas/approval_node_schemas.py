"""
审批节点 Schema 模块

定义审批节点数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ApprovalNodeBase(BaseModel):
    """审批节点基础 Schema"""
    
    node_no: str = Field(..., max_length=50, description="节点编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("node_no")
    def validate_node_no(cls, v):
        """验证节点编号格式"""
        if not v or not v.strip():
            raise ValueError("节点编号不能为空")
        return v.strip()


class ApprovalNodeCreate(ApprovalNodeBase):
    """创建审批节点 Schema"""
    pass


class ApprovalNodeUpdate(BaseModel):
    """更新审批节点 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ApprovalNodeResponse(ApprovalNodeBase):
    """审批节点响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
