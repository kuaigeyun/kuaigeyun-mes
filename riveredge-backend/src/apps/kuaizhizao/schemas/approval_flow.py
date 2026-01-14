"""
审核流程Schema

提供审核流程相关的数据验证Schema。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

from apps.kuaizhizao.models.approval_flow import ApprovalFlow, ApprovalFlowStep, ApprovalRecord


class ApprovalFlowStepBase(BaseModel):
    """审核流程步骤基础Schema"""
    step_order: int = Field(..., ge=1, description="步骤顺序（从1开始）")
    step_name: str = Field(..., max_length=200, description="步骤名称")
    approval_mode: str = Field("sequential", max_length=20, description="审核模式")
    approver_config: Dict[str, Any] = Field(..., description="审核人配置")
    approval_conditions: Optional[Dict[str, Any]] = Field(None, description="审核条件")
    is_required: bool = Field(True, description="是否必填")
    description: Optional[str] = Field(None, description="步骤描述")
    
    @field_validator("approval_mode")
    def validate_approval_mode(cls, v):
        """验证审核模式"""
        allowed_modes = ["sequential", "parallel_all", "parallel_any"]
        if v not in allowed_modes:
            raise ValueError(f"审核模式必须是: {', '.join(allowed_modes)}")
        return v


class ApprovalFlowBase(BaseModel):
    """审核流程基础Schema"""
    flow_code: str = Field(..., max_length=50, description="流程编码")
    flow_name: str = Field(..., max_length=200, description="流程名称")
    entity_type: str = Field(..., max_length=50, description="实体类型")
    business_mode: Optional[str] = Field(None, max_length=20, description="业务模式")
    demand_type: Optional[str] = Field(None, max_length=20, description="需求类型")
    is_active: bool = Field(True, description="是否启用")
    description: Optional[str] = Field(None, description="流程描述")
    steps: List[ApprovalFlowStepBase] = Field(default_factory=list, description="流程步骤列表")


class ApprovalFlowCreate(ApprovalFlowBase):
    """创建审核流程Schema"""
    pass


class ApprovalFlowUpdate(BaseModel):
    """更新审核流程Schema"""
    flow_name: Optional[str] = Field(None, max_length=200, description="流程名称")
    is_active: Optional[bool] = Field(None, description="是否启用")
    description: Optional[str] = Field(None, description="流程描述")
    steps: Optional[List[ApprovalFlowStepBase]] = Field(None, description="流程步骤列表")


class ApprovalFlowStepResponse(BaseModel):
    """审核流程步骤响应Schema"""
    id: int
    flow_id: int
    step_order: int
    step_name: str
    approval_mode: str
    approver_config: Dict[str, Any]
    approval_conditions: Optional[Dict[str, Any]]
    is_required: bool
    description: Optional[str]
    
    class Config:
        from_attributes = True


class ApprovalFlowResponse(ApprovalFlowBase):
    """审核流程响应Schema"""
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    updated_by: Optional[int]
    steps: List[ApprovalFlowStepResponse] = Field(default_factory=list)
    
    class Config:
        from_attributes = True


class ApprovalRecordResponse(BaseModel):
    """审核记录响应Schema"""
    id: int
    uuid: str
    tenant_id: int
    entity_type: str
    entity_id: int
    flow_id: Optional[int]
    flow_code: Optional[str]
    step_order: Optional[int]
    step_name: Optional[str]
    approver_id: int
    approver_name: str
    approval_result: str
    approval_comment: Optional[str]
    approval_time: datetime
    flow_status: str
    created_at: datetime
    
    class Config:
        from_attributes = True
