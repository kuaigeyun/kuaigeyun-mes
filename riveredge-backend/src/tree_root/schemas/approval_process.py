"""
审批流程 Schema 模块

定义审批流程相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class ApprovalProcessBase(BaseModel):
    """审批流程基础 Schema"""
    name: str = Field(..., max_length=100, description="流程名称")
    code: str = Field(..., max_length=50, description="流程代码")
    description: Optional[str] = Field(None, description="流程描述")
    nodes: Dict[str, Any] = Field(..., description="流程节点配置（ProFlow 设计）")
    config: Dict[str, Any] = Field(..., description="流程配置")
    is_active: bool = Field(True, description="是否启用")


class ApprovalProcessCreate(ApprovalProcessBase):
    """创建审批流程 Schema"""
    pass


class ApprovalProcessUpdate(BaseModel):
    """更新审批流程 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="流程名称")
    description: Optional[str] = Field(None, description="流程描述")
    nodes: Optional[Dict[str, Any]] = Field(None, description="流程节点配置")
    config: Optional[Dict[str, Any]] = Field(None, description="流程配置")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ApprovalProcessResponse(ApprovalProcessBase):
    """审批流程响应 Schema"""
    uuid: UUID = Field(..., description="审批流程UUID")
    tenant_id: int = Field(..., description="组织ID")
    inngest_workflow_id: Optional[str] = Field(None, description="Inngest 工作流ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

