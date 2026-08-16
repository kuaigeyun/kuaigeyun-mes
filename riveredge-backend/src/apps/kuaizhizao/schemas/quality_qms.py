"""质量体系 schemas：体系文件 / 内审 / 管理评审"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class QmsEvidenceLink(BaseSchema):
    ref_type: str = Field(..., description="证据类型")
    ref_id: Optional[int] = None
    ref_code: Optional[str] = None
    ref_name: Optional[str] = None
    path: Optional[str] = None
    note: Optional[str] = None


class QmsSystemDocumentBase(BaseSchema):
    document_code: Optional[str] = Field(None, description="文件编码")
    title: str = Field(..., description="标题")
    doc_type: str = Field("procedure", description="文件类型")
    version: str = Field("A0", description="版本")
    status: str = Field("draft", description="状态")
    iso_clause: Optional[str] = None
    iso_clause_id: Optional[int] = None
    content: Optional[str] = None
    file_url: Optional[str] = None
    effective_at: Optional[datetime] = None
    obsolete_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    owner_name: Optional[str] = None
    evidence_links: Optional[List[Any]] = None
    training_refs: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None


class QmsSystemDocumentCreate(QmsSystemDocumentBase):
    pass


class QmsSystemDocumentUpdate(BaseSchema):
    title: Optional[str] = None
    doc_type: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    iso_clause: Optional[str] = None
    iso_clause_id: Optional[int] = None
    content: Optional[str] = None
    file_url: Optional[str] = None
    effective_at: Optional[datetime] = None
    obsolete_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    owner_name: Optional[str] = None
    evidence_links: Optional[List[Any]] = None
    training_refs: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None
    document_code: Optional[str] = None


class QmsSystemDocumentResponse(QmsSystemDocumentBase):
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QmsSystemDocumentListResponse(BaseSchema):
    items: List[QmsSystemDocumentResponse]
    total: int


class QmsInternalAuditBase(BaseSchema):
    audit_code: Optional[str] = None
    title: str
    audit_scope: Optional[str] = None
    iso_clause: Optional[str] = None
    iso_clause_id: Optional[int] = None
    status: str = Field("planned")
    planned_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    lead_auditor: Optional[str] = None
    audit_team: Optional[str] = None
    checklist: Optional[str] = None
    findings: Optional[str] = None
    conclusion: Optional[str] = None
    finding_links: Optional[List[Any]] = None
    training_refs: Optional[List[Any]] = None
    calibration_refs: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None


class QmsInternalAuditCreate(QmsInternalAuditBase):
    pass


class QmsInternalAuditUpdate(BaseSchema):
    title: Optional[str] = None
    audit_scope: Optional[str] = None
    iso_clause: Optional[str] = None
    iso_clause_id: Optional[int] = None
    status: Optional[str] = None
    planned_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    lead_auditor: Optional[str] = None
    audit_team: Optional[str] = None
    checklist: Optional[str] = None
    findings: Optional[str] = None
    conclusion: Optional[str] = None
    finding_links: Optional[List[Any]] = None
    training_refs: Optional[List[Any]] = None
    calibration_refs: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None
    audit_code: Optional[str] = None


class QmsInternalAuditResponse(QmsInternalAuditBase):
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QmsInternalAuditListResponse(BaseSchema):
    items: List[QmsInternalAuditResponse]
    total: int


class QmsManagementReviewBase(BaseSchema):
    review_code: Optional[str] = None
    title: str
    status: str = Field("draft")
    review_date: Optional[datetime] = None
    chairperson: Optional[str] = None
    attendees: Optional[str] = None
    inputs_summary: Optional[str] = None
    outputs_summary: Optional[str] = None
    input_links: Optional[List[Any]] = None
    training_refs: Optional[List[Any]] = None
    calibration_refs: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None


class QmsManagementReviewCreate(QmsManagementReviewBase):
    pass


class QmsManagementReviewUpdate(BaseSchema):
    title: Optional[str] = None
    status: Optional[str] = None
    review_date: Optional[datetime] = None
    chairperson: Optional[str] = None
    attendees: Optional[str] = None
    inputs_summary: Optional[str] = None
    outputs_summary: Optional[str] = None
    input_links: Optional[List[Any]] = None
    training_refs: Optional[List[Any]] = None
    calibration_refs: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None
    review_code: Optional[str] = None


class QmsManagementReviewResponse(QmsManagementReviewBase):
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QmsManagementReviewListResponse(BaseSchema):
    items: List[QmsManagementReviewResponse]
    total: int


class QmsSystemDocumentReviewDueSummary(BaseSchema):
    due_count: int = Field(..., description="待复审文件数（生效中且 next_review_at 已到期或为空不计）")


class QmsManagementReviewInputSummary(BaseSchema):
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    nonconforming_count: int = 0
    open_8d_count: int = 0
    iqc_total: int = 0
    iqc_pass_count: int = 0
    iqc_pass_rate: Optional[float] = None
    oqc_total: int = 0
    oqc_pass_count: int = 0
    oqc_pass_rate: Optional[float] = None
    summary_text: str = ""


class QmsIsoClauseBase(BaseSchema):
    standard_code: str = Field(..., description="标准编码")
    clause_code: str = Field(..., description="条款号")
    title: str = Field(..., description="条款标题")
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = Field(0, description="排序")
    is_active: bool = Field(True, description="是否启用")


class QmsIsoClauseCreate(QmsIsoClauseBase):
    pass


class QmsIsoClauseUpdate(BaseSchema):
    standard_code: Optional[str] = None
    clause_code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class QmsIsoClauseResponse(QmsIsoClauseBase):
    id: int
    uuid: str
    tenant_id: int
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QmsIsoClauseListResponse(BaseSchema):
    items: List[QmsIsoClauseResponse]
    total: int


class QmsIsoClauseTreeNode(QmsIsoClauseResponse):
    children: List["QmsIsoClauseTreeNode"] = Field(default_factory=list)


class QmsIsoClauseComplianceSummary(BaseSchema):
    effective_document_count: int = 0
    review_due_count: int = 0
    internal_audit_count: int = 0
    last_audit_date: Optional[datetime] = None
    has_gap: bool = False
    no_effective_document: bool = False
    no_completed_audit: bool = False
    compliance_status: str = Field("gap", description="covered|review_due|gap")


class QmsIsoClauseLoadPresetResult(BaseSchema):
    created: int = 0
    skipped: int = 0
    linked: int = 0


class QmsIsoClauseRelatedDocumentsResponse(BaseSchema):
    items: List[QmsSystemDocumentResponse]


class QmsIsoClauseRelatedAuditsResponse(BaseSchema):
    items: List[QmsInternalAuditResponse]


QmsIsoClauseTreeNode.model_rebuild()
