"""
用户任务 Schema 模块

定义用户任务相关的 Pydantic Schema，用于数据验证和序列化。
复用 ApprovalInstance 模型，但提供用户视角的 Schema。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class UserTaskResponse(BaseModel):
    """用户任务响应 Schema（复用 ApprovalInstance）"""
    uuid: UUID = Field(..., description="任务UUID")
    tenant_id: int = Field(..., description="组织ID")
    process_uuid: Optional[UUID] = Field(None, description="关联审批流程UUID")
    title: str = Field(..., description="任务标题")
    content: Optional[str] = Field(None, description="任务内容")
    data: Optional[Dict[str, Any]] = Field(None, description="审批数据（JSON格式）")
    submitter_id: int = Field(..., description="提交人ID")
    current_approver_id: Optional[int] = Field(None, description="当前审批人ID（当前用户）")
    status: str = Field(..., description="任务状态（pending、approved、rejected、cancelled）")
    current_node: Optional[str] = Field(None, description="当前节点")
    submitted_at: Optional[datetime] = Field(None, description="提交时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class UserTaskListResponse(BaseModel):
    """用户任务列表响应 Schema"""
    items: List[UserTaskResponse] = Field(..., description="任务列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class UserTaskStatsResponse(BaseModel):
    """用户任务统计响应 Schema"""
    total: int = Field(..., description="总任务数")
    pending: int = Field(..., description="待处理任务数")
    approved: int = Field(..., description="已通过任务数")
    rejected: int = Field(..., description="已拒绝任务数")
    submitted: int = Field(..., description="我提交的任务数")


class UserTaskActionRequest(BaseModel):
    """用户任务操作请求 Schema"""
    action: str = Field(..., description="操作类型（approve、reject）")
    comment: Optional[str] = Field(None, description="审批意见")

