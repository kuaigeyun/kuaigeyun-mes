"""
BOM 工程变更记录 Schema 模块

定义 BOM 工程变更（ECN）的 Pydantic Schema，用于数据验证和序列化。

Author: AI Assistant
Date: 2026-03-16
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


class BOMChangeBase(BaseModel):
    """BOM 工程变更记录基础 Schema"""

    material_uuid: str = Field(..., description="主物料UUID（BOM 父件）")
    change_type: str = Field(
        ...,
        max_length=50,
        description="变更类型（item_add/item_remove/item_modify/version_change/effective_change/other）",
    )
    change_content: Optional[Dict[str, Any]] = Field(None, description="变更内容（JSON格式）")
    change_reason: Optional[str] = Field(None, description="变更原因")
    change_impact: Optional[Dict[str, Any]] = Field(None, description="变更影响分析（JSON格式）")
    status: str = Field("pending", max_length=20, description="变更状态")
    approval_comment: Optional[str] = Field(None, description="审批意见（可选）")
    bom_code: Optional[str] = Field(None, max_length=100, description="关联的 BOM 编码（可选）")
    from_version: Optional[str] = Field(None, max_length=50, description="变更前版本（可选）")
    to_version: Optional[str] = Field(None, max_length=50, description="变更后版本（可选）")

    @field_validator("change_type")
    @classmethod
    def validate_change_type(cls, v: str) -> str:
        allowed = ["item_add", "item_remove", "item_modify", "version_change", "effective_change", "other"]
        if v not in allowed:
            raise ValueError(f"变更类型必须是: {', '.join(allowed)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = ["pending", "approved", "rejected", "executed", "cancelled"]
        if v not in allowed:
            raise ValueError(f"变更状态必须是: {', '.join(allowed)}")
        return v


class BOMChangeCreate(BOMChangeBase):
    """创建 BOM 工程变更记录 Schema"""
    pass


class BOMChangeUpdate(BaseModel):
    """更新 BOM 工程变更记录 Schema"""

    change_content: Optional[Dict[str, Any]] = Field(None, description="变更内容（JSON格式）")
    change_reason: Optional[str] = Field(None, description="变更原因")
    change_impact: Optional[Dict[str, Any]] = Field(None, description="变更影响分析（JSON格式）")
    status: Optional[str] = Field(None, max_length=20, description="变更状态")
    approval_comment: Optional[str] = Field(None, description="审批意见（可选）")
    bom_code: Optional[str] = Field(None, max_length=100, description="关联的 BOM 编码（可选）")
    from_version: Optional[str] = Field(None, max_length=50, description="变更前版本（可选）")
    to_version: Optional[str] = Field(None, max_length=50, description="变更后版本（可选）")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            allowed = ["pending", "approved", "rejected", "executed", "cancelled"]
            if v not in allowed:
                raise ValueError(f"变更状态必须是: {', '.join(allowed)}")
        return v


class BOMChangeResponse(BOMChangeBase):
    """BOM 工程变更记录响应 Schema"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    material_id: int = Field(..., description="主物料ID")
    material_code: Optional[str] = Field(None, description="主物料编码")
    material_name: Optional[str] = Field(None, description="主物料名称")
    applicant_id: int = Field(..., description="申请人ID")
    applicant_name: Optional[str] = Field(None, description="申请人姓名")
    approver_id: Optional[int] = Field(None, description="审批人ID")
    approver_name: Optional[str] = Field(None, description="审批人姓名")
    applied_at: Optional[datetime] = Field(None, description="应用时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")

    model_config = ConfigDict(from_attributes=True)


class BOMChangeListResponse(BaseModel):
    """BOM 工程变更记录列表响应 Schema"""

    items: List[BOMChangeResponse] = Field(..., description="变更记录列表")
    total: int = Field(..., description="总数")
