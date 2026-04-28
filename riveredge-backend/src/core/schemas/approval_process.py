"""
审批流程 Schema 模块

定义审批流程相关的 Pydantic Schema，用于数据验证和序列化。
"""

import json
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


def normalize_json_object_field(v: Any) -> Dict[str, Any]:
    """
    将 Tortoise JSONField / 历史脏数据规范为 dict。
    生产库中常见 nodes=[]（JSON 数组），而 ProFlow 约定顶层为对象。
    """
    if isinstance(v, dict):
        return v
    if v is None:
        return {}
    if isinstance(v, list):
        return {}
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return {}
        try:
            parsed = json.loads(s)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return {}
        except json.JSONDecodeError:
            return {}
    return {}


class ApprovalProcessBase(BaseModel):
    """审批流程基础 Schema"""
    name: str = Field(..., max_length=100, description="流程名称")
    code: str = Field(..., max_length=50, description="流程代码")
    description: Optional[str] = Field(None, description="流程描述")
    nodes: Dict[str, Any] = Field(..., description="流程节点配置（ProFlow 设计）")
    config: Dict[str, Any] = Field(..., description="流程配置")
    is_active: bool = Field(True, description="是否启用")

    @field_validator("nodes", "config", mode="before")
    @classmethod
    def _coerce_nodes_config(cls, v: Any) -> Dict[str, Any]:
        return normalize_json_object_field(v)


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

    @field_validator("nodes", "config", mode="before")
    @classmethod
    def _coerce_optional_json(cls, v: Any) -> Any:
        if v is None:
            return None
        return normalize_json_object_field(v)


class ApprovalProcessResponse(ApprovalProcessBase):
    """审批流程响应 Schema"""
    uuid: UUID = Field(..., description="审批流程UUID")
    tenant_id: int = Field(..., description="组织ID")
    inngest_workflow_id: Optional[str] = Field(None, description="Inngest 工作流ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

