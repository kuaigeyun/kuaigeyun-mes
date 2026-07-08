"""
质检方案 Schema 模块

定义质检方案及步骤的数据验证和序列化。

Author: RiverEdge Team
Date: 2026-02-26
"""

from datetime import datetime
from typing import Optional, List, Any, Dict

from pydantic import Field, field_validator, model_validator
from core.schemas.base import BaseSchema
from apps.kuaizhizao.services.inspection_step_spec import (
    INSPECTION_STEP_VALUE_TYPES,
    normalize_value_type,
    normalize_value_spec,
    format_acceptance_criteria,
    validate_plan_step_dict,
)


# === 质检方案步骤 ===

class InspectionPlanStepBase(BaseSchema):
    """质检方案步骤基础 schema"""
    sequence: int = Field(0, description="步骤序号")
    step_key: Optional[str] = Field(None, max_length=36, description="步骤稳定标识")
    inspection_item: str = Field(..., max_length=200, description="检验项目名称")
    inspection_method: Optional[str] = Field(None, max_length=200, description="检验方法")
    acceptance_criteria: Optional[str] = Field(None, description="合格标准")
    value_type: str = Field("boolean", max_length=20, description="值类型")
    value_spec: Optional[Dict[str, Any]] = Field(None, description="类型规格 JSON")
    sampling_type: str = Field("full", max_length=20, description="抽样方式（full/sampling）")
    quality_standard_id: Optional[int] = Field(None, description="引用的质检标准ID（可选）")
    remarks: Optional[str] = Field(None, description="备注")

    @field_validator("value_type")
    @classmethod
    def validate_value_type(cls, v: str) -> str:
        return normalize_value_type(v)

    @model_validator(mode="after")
    def normalize_step_spec(self) -> "InspectionPlanStepBase":
        vt = normalize_value_type(self.value_type)
        spec = normalize_value_spec(vt, self.value_spec)
        object.__setattr__(self, "value_type", vt)
        object.__setattr__(self, "value_spec", spec)
        if not self.acceptance_criteria:
            auto = format_acceptance_criteria(vt, spec)
            if auto:
                object.__setattr__(self, "acceptance_criteria", auto)
        validate_plan_step_dict(self.model_dump())
        return self


class InspectionPlanStepCreate(InspectionPlanStepBase):
    """质检方案步骤创建 schema"""
    pass


class InspectionPlanStepUpdate(InspectionPlanStepBase):
    """质检方案步骤更新 schema"""
    sequence: Optional[int] = Field(None, description="步骤序号")
    inspection_item: Optional[str] = Field(None, max_length=200, description="检验项目名称")


class InspectionPlanStepResponse(InspectionPlanStepBase):
    """质检方案步骤响应 schema"""
    id: int = Field(..., description="步骤ID")
    plan_id: int = Field(..., description="质检方案ID")

    class Config:
        from_attributes = True


# 导出供前端文档引用
INSPECTION_PLAN_STEP_VALUE_TYPES = INSPECTION_STEP_VALUE_TYPES


# === 质检方案 ===

class InspectionPlanBase(BaseSchema):
    """质检方案基础 schema"""
    plan_code: str = Field(..., max_length=50, description="方案编码")
    plan_name: str = Field(..., max_length=200, description="方案名称")
    plan_type: str = Field(..., max_length=50, description="类型（incoming/process/finished）")
    material_id: Optional[int] = Field(None, description="适用物料ID（可选）")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    operation_id: Optional[int] = Field(None, description="适用工序ID（过程检验时）")
    version: str = Field("1.0", max_length=20, description="版本号")
    is_active: bool = Field(True, description="是否启用")
    remarks: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class InspectionPlanCreate(InspectionPlanBase):
    """质检方案创建 schema"""
    plan_code: Optional[str] = Field(None, max_length=50, description="方案编码（可选，不提供则自动生成）")
    steps: Optional[List[InspectionPlanStepCreate]] = Field(None, description="检验步骤列表")


class InspectionPlanUpdate(InspectionPlanBase):
    """质检方案更新 schema"""
    plan_code: Optional[str] = Field(None, max_length=50, description="方案编码")
    plan_name: Optional[str] = Field(None, max_length=200, description="方案名称")
    plan_type: Optional[str] = Field(None, max_length=50, description="类型")
    steps: Optional[List[InspectionPlanStepCreate]] = Field(None, description="检验步骤列表（全量替换）")


class InspectionPlanResponse(InspectionPlanBase):
    """质检方案响应 schema"""
    id: int = Field(..., description="方案ID")
    uuid: Optional[str] = Field(None, description="业务ID")
    tenant_id: Optional[int] = Field(None, description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    steps: Optional[List[InspectionPlanStepResponse]] = Field(None, description="检验步骤列表")

    class Config:
        from_attributes = True


class InspectionPlanListResponse(InspectionPlanResponse):
    """质检方案列表响应 schema（简化版）"""
    steps: Optional[List[InspectionPlanStepResponse]] = Field(None, description="检验步骤列表（列表页可省略）")


class InspectionPlanListEnvelope(BaseSchema):
    items: List[InspectionPlanListResponse]
    total: int
