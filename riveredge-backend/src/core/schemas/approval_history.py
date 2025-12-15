"""
审批历史记录 Schema 模块

定义审批历史记录相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class ApprovalHistoryResponse(BaseModel):
    """审批历史记录响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: UUID = Field(..., description="审批历史记录UUID")
    tenant_id: int = Field(..., description="组织ID")
    approval_instance_id: int = Field(..., description="审批实例ID")
    action: str = Field(..., description="操作类型")
    action_by: int = Field(..., description="操作人ID")
    action_at: datetime = Field(..., description="操作时间")
    comment: Optional[str] = Field(None, description="审批意见")
    from_node: Optional[str] = Field(None, description="来源节点")
    to_node: Optional[str] = Field(None, description="目标节点")
    from_approver_id: Optional[int] = Field(None, description="原审批人ID")
    to_approver_id: Optional[int] = Field(None, description="新审批人ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)
