"""
工艺路线变更记录 Schema 模块

定义工艺路线变更记录的 Pydantic Schema，用于数据验证和序列化。

Author: Luigi Lu
Date: 2026-01-27
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime


class ProcessRouteChangeBase(BaseModel):
    """工艺路线变更记录基础 Schema"""
    
    process_route_uuid: str = Field(..., description="工艺路线UUID")
    change_type: str = Field(..., max_length=50, description="变更类型（operation_change:工序变更, time_change:标准工时变更, sop_change:SOP变更, other:其他）")
    change_content: Optional[Dict[str, Any]] = Field(None, description="变更内容（JSON格式）")
    change_reason: Optional[str] = Field(None, description="变更原因")
    change_impact: Optional[Dict[str, Any]] = Field(None, description="变更影响分析（JSON格式）")
    status: str = Field("pending", max_length=20, description="变更状态")
    approval_comment: Optional[str] = Field(None, description="审批意见（可选）")
    
    @validator("change_type")
    def validate_change_type(cls, v):
        """验证变更类型"""
        allowed_types = ["operation_change", "time_change", "sop_change", "other"]
        if v not in allowed_types:
            raise ValueError(f"变更类型必须是: {', '.join(allowed_types)}")
        return v
    
    @validator("status")
    def validate_status(cls, v):
        """验证变更状态"""
        allowed_statuses = ["pending", "approved", "rejected", "executed", "cancelled"]
        if v not in allowed_statuses:
            raise ValueError(f"变更状态必须是: {', '.join(allowed_statuses)}")
        return v


class ProcessRouteChangeCreate(ProcessRouteChangeBase):
    """创建工艺路线变更记录 Schema"""
    pass


class ProcessRouteChangeUpdate(BaseModel):
    """更新工艺路线变更记录 Schema"""
    
    change_content: Optional[Dict[str, Any]] = Field(None, description="变更内容（JSON格式）")
    change_reason: Optional[str] = Field(None, description="变更原因")
    change_impact: Optional[Dict[str, Any]] = Field(None, description="变更影响分析（JSON格式）")
    status: Optional[str] = Field(None, max_length=20, description="变更状态")
    approval_comment: Optional[str] = Field(None, description="审批意见（可选）")
    
    @validator("status")
    def validate_status(cls, v):
        """验证变更状态"""
        if v is not None:
            allowed_statuses = ["pending", "approved", "rejected", "executed", "cancelled"]
            if v not in allowed_statuses:
                raise ValueError(f"变更状态必须是: {', '.join(allowed_statuses)}")
        return v


class ProcessRouteChangeResponse(ProcessRouteChangeBase):
    """工艺路线变更记录响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    process_route_id: int = Field(..., description="工艺路线ID")
    process_route_code: Optional[str] = Field(None, description="工艺路线编码")
    process_route_name: Optional[str] = Field(None, description="工艺路线名称")
    applicant_id: int = Field(..., description="申请人ID")
    applicant_name: Optional[str] = Field(None, description="申请人姓名")
    approver_id: Optional[int] = Field(None, description="审批人ID")
    approver_name: Optional[str] = Field(None, description="审批人姓名")
    applied_at: Optional[datetime] = Field(None, description="应用时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class ProcessRouteChangeListResponse(BaseModel):
    """工艺路线变更记录列表响应 Schema"""
    
    items: List[ProcessRouteChangeResponse] = Field(..., description="变更记录列表")
    total: int = Field(..., description="总数")
