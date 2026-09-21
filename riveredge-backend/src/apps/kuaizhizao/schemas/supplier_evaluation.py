"""供应商评价 / 模板 / 环保资料 Schema（R-03）。"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SupplierEvalTemplateClauseInput(BaseModel):
    line_no: Optional[int] = None
    clause_code: str
    clause_name: str
    weight: Decimal = Decimal("1")
    max_score: Decimal = Decimal("100")
    remarks: Optional[str] = None


class SupplierEvalTemplateClauseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    template_id: int
    line_no: int
    clause_code: str
    clause_name: str
    weight: Decimal
    max_score: Decimal
    remarks: Optional[str] = None


class SupplierEvalTemplateCreate(BaseModel):
    code: Optional[str] = None
    name: str
    version: str = "v1"
    grade_version: str = "v1"
    grade_bands: Optional[List[dict]] = None
    period_type: Optional[str] = None
    is_active: bool = True
    remarks: Optional[str] = None
    clauses: List[SupplierEvalTemplateClauseInput] = Field(default_factory=list)


class SupplierEvalTemplateUpdate(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    grade_version: Optional[str] = None
    grade_bands: Optional[List[dict]] = None
    period_type: Optional[str] = None
    is_active: Optional[bool] = None
    remarks: Optional[str] = None
    clauses: Optional[List[SupplierEvalTemplateClauseInput]] = None


class SupplierEvalTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    name: str
    version: str
    grade_version: str
    grade_bands: Optional[Any] = None
    period_type: Optional[str] = None
    is_active: bool = True
    remarks: Optional[str] = None
    clauses: List[SupplierEvalTemplateClauseResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SupplierEvalTemplateListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    name: str
    version: str
    grade_version: str
    period_type: Optional[str] = None
    is_active: bool = True
    clause_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SupplierEvalTemplateListResponse(BaseModel):
    data: List[SupplierEvalTemplateListItem]
    total: int
    success: bool = True


class SupplierEvaluationLineInput(BaseModel):
    line_no: Optional[int] = None
    clause_code: str
    clause_name: str
    weight: Decimal = Decimal("1")
    max_score: Decimal = Decimal("100")
    score: Optional[Decimal] = None
    remarks: Optional[str] = None


class SupplierEvaluationLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    evaluation_id: int
    line_no: int
    clause_code: str
    clause_name: str
    weight: Decimal
    max_score: Decimal
    score: Optional[Decimal] = None
    remarks: Optional[str] = None


class SupplierEvaluationCreate(BaseModel):
    code: Optional[str] = None
    period_type: str = "annual"
    period_year: int
    period_quarter: Optional[int] = None
    supplier_id: int
    template_id: Optional[int] = None
    audit_mode: str = "document"
    score: Optional[Decimal] = None
    grade: Optional[str] = None
    formula_version: Optional[str] = None
    grade_version: Optional[str] = None
    needs_rectification: bool = False
    rectification_plan: Optional[str] = None
    rectification_due: Optional[date] = None
    attachments: Optional[List[dict]] = None
    remarks: Optional[str] = None
    lines: Optional[List[SupplierEvaluationLineInput]] = None


class SupplierEvaluationUpdate(BaseModel):
    period_type: Optional[str] = None
    period_year: Optional[int] = None
    period_quarter: Optional[int] = None
    supplier_id: Optional[int] = None
    template_id: Optional[int] = None
    audit_mode: Optional[str] = None
    score: Optional[Decimal] = None
    grade: Optional[str] = None
    formula_version: Optional[str] = None
    grade_version: Optional[str] = None
    needs_rectification: Optional[bool] = None
    rectification_plan: Optional[str] = None
    rectification_due: Optional[date] = None
    rectification_status: Optional[str] = None
    attachments: Optional[List[dict]] = None
    remarks: Optional[str] = None
    lines: Optional[List[SupplierEvaluationLineInput]] = None


class SupplierEvaluationRevokeRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class SupplierEvaluationCloseRectificationRequest(BaseModel):
    result: str = Field(..., min_length=1, description="整改结果说明")


class SupplierEvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    period_type: str
    period_year: int
    period_quarter: Optional[int] = None
    supplier_id: int
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    template_id: Optional[int] = None
    template_code: Optional[str] = None
    template_name: Optional[str] = None
    plan_id: Optional[int] = None
    plan_code: Optional[str] = None
    audit_mode: str
    score: Optional[Decimal] = None
    grade: Optional[str] = None
    formula_version: Optional[str] = None
    grade_version: Optional[str] = None
    needs_rectification: bool = False
    rectification_plan: Optional[str] = None
    rectification_due: Optional[date] = None
    rectification_status: str = "none"
    rectification_result: Optional[str] = None
    rectification_closed_at: Optional[datetime] = None
    rectification_closed_by_name: Optional[str] = None
    status: str
    attachments: Optional[Any] = None
    lines: List[SupplierEvaluationLineResponse] = Field(default_factory=list)
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SupplierEvaluationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    period_type: str
    period_year: int
    period_quarter: Optional[int] = None
    supplier_id: int
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    template_code: Optional[str] = None
    template_name: Optional[str] = None
    plan_code: Optional[str] = None
    audit_mode: str
    score: Optional[Decimal] = None
    grade: Optional[str] = None
    formula_version: Optional[str] = None
    grade_version: Optional[str] = None
    needs_rectification: bool = False
    rectification_status: str = "none"
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SupplierEvaluationListResponse(BaseModel):
    data: List[SupplierEvaluationListItem]
    total: int
    success: bool = True


class SupplierEvalEnvDocumentCreate(BaseModel):
    supplier_id: int
    doc_type: str = "other"
    title: str
    issued_at: Optional[date] = None
    expires_at: Optional[date] = None
    attachments: Optional[List[dict]] = None
    remarks: Optional[str] = None


class SupplierEvalEnvDocumentUpdate(BaseModel):
    doc_type: Optional[str] = None
    title: Optional[str] = None
    issued_at: Optional[date] = None
    expires_at: Optional[date] = None
    attachments: Optional[List[dict]] = None
    remarks: Optional[str] = None


class SupplierEvalEnvDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    supplier_id: int
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    doc_type: str
    title: str
    issued_at: Optional[date] = None
    expires_at: Optional[date] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SupplierEvalEnvDocumentListResponse(BaseModel):
    data: List[SupplierEvalEnvDocumentResponse]
    total: int
    success: bool = True


class SupplierEvalPlanLineInput(BaseModel):
    line_no: Optional[int] = None
    supplier_id: int
    remarks: Optional[str] = None


class SupplierEvalPlanLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    plan_id: int
    line_no: int
    supplier_id: int
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    remarks: Optional[str] = None
    evaluation_id: Optional[int] = None
    evaluation_code: Optional[str] = None
    evaluation_status: Optional[str] = None


class SupplierEvalPlanCreate(BaseModel):
    code: Optional[str] = None
    name: str
    period_type: str = "annual"
    period_year: int
    period_quarter: Optional[int] = None
    template_id: int
    audit_mode: str = "document"
    reminder_lead_days: int = Field(7, ge=1, le=365, description="评价截止前提醒提前天数")
    remarks: Optional[str] = None
    lines: List[SupplierEvalPlanLineInput] = Field(default_factory=list)


class SupplierEvalPlanUpdate(BaseModel):
    name: Optional[str] = None
    period_type: Optional[str] = None
    period_year: Optional[int] = None
    period_quarter: Optional[int] = None
    template_id: Optional[int] = None
    audit_mode: Optional[str] = None
    reminder_lead_days: Optional[int] = Field(None, ge=1, le=365)
    remarks: Optional[str] = None
    lines: Optional[List[SupplierEvalPlanLineInput]] = None


class SupplierEvalPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    name: str
    period_type: str
    period_year: int
    period_quarter: Optional[int] = None
    template_id: int
    template_code: Optional[str] = None
    template_name: Optional[str] = None
    audit_mode: str
    reminder_lead_days: int = 7
    status: str
    remarks: Optional[str] = None
    lines: List[SupplierEvalPlanLineResponse] = Field(default_factory=list)
    line_count: int = 0
    generated_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SupplierEvalPlanListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    name: str
    period_type: str
    period_year: int
    period_quarter: Optional[int] = None
    template_code: Optional[str] = None
    template_name: Optional[str] = None
    status: str
    line_count: int = 0
    generated_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SupplierEvalPlanListResponse(BaseModel):
    data: List[SupplierEvalPlanListItem]
    total: int
    success: bool = True


class SupplierEvalPlanGenerateResult(BaseModel):
    created: int = 0
    skipped: int = 0
    evaluation_ids: List[int] = Field(default_factory=list)
    skipped_supplier_ids: List[int] = Field(default_factory=list)


class SupplierEvalSummaryResponse(BaseModel):
    period_type: Optional[str] = None
    period_year: Optional[int] = None
    period_quarter: Optional[int] = None
    total: int = 0
    by_status: dict = Field(default_factory=dict)
    by_grade: dict = Field(default_factory=dict)
    approved_count: int = 0
    avg_score: Optional[Decimal] = None
    open_rectification: int = 0
    needs_rectification: int = 0
