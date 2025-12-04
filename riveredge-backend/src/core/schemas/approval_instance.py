"""
审批实例 Schema 模块

定义审批实例相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class ApprovalInstanceBase(BaseModel):
    """审批实例基础 Schema"""
    process_uuid: UUID = Field(..., description="关联流程UUID")
    title: str = Field(..., max_length=200, description="审批标题")
    content: Optional[str] = Field(None, description="审批内容")
    data: Optional[Dict[str, Any]] = Field(None, description="审批数据")


class ApprovalInstanceCreate(ApprovalInstanceBase):
    """创建审批实例 Schema"""
    pass


class ApprovalInstanceUpdate(BaseModel):
    """更新审批实例 Schema"""
    title: Optional[str] = Field(None, max_length=200, description="审批标题")
    content: Optional[str] = Field(None, description="审批内容")
    data: Optional[Dict[str, Any]] = Field(None, description="审批数据")
    status: Optional[str] = Field(None, max_length=20, description="审批状态")
    current_node: Optional[str] = Field(None, max_length=100, description="当前节点")
    current_approver_id: Optional[int] = Field(None, description="当前审批人ID")
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        """验证审批状态"""
        if v is None:
            return v
        allowed_statuses = ['pending', 'approved', 'rejected', 'cancelled']
        if v not in allowed_statuses:
            raise ValueError(f'审批状态必须是 {allowed_statuses} 之一')
        return v


class ApprovalInstanceAction(BaseModel):
    """审批操作 Schema"""
    action: str = Field(..., description="操作类型（approve、reject、cancel、transfer）")
    comment: Optional[str] = Field(None, description="审批意见")
    transfer_to_user_id: Optional[int] = Field(None, description="转交目标用户ID（仅转交时使用）")
    
    @field_validator('action')
    @classmethod
    def validate_action(cls, v):
        """验证操作类型"""
        allowed_actions = ['approve', 'reject', 'cancel', 'transfer']
        if v not in allowed_actions:
            raise ValueError(f'操作类型必须是 {allowed_actions} 之一')
        return v


class ApprovalInstanceResponse(ApprovalInstanceBase):
    """审批实例响应 Schema"""
    uuid: UUID = Field(..., description="审批实例UUID")
    tenant_id: int = Field(..., description="组织ID")
    process_uuid: UUID = Field(..., description="关联流程UUID")
    status: str = Field(..., description="审批状态")
    current_node: Optional[str] = Field(None, description="当前节点")
    current_approver_id: Optional[int] = Field(None, description="当前审批人ID")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    submitter_id: int = Field(..., description="提交人ID")
    submitted_at: datetime = Field(..., description="提交时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

