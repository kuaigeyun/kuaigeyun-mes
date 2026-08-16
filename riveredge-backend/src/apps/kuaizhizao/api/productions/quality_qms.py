"""质量体系 API：体系文件 / 内审 / 管理评审"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from datetime import datetime

from apps.kuaizhizao.schemas.quality_qms import (
    QmsInternalAuditCreate,
    QmsInternalAuditListResponse,
    QmsInternalAuditResponse,
    QmsInternalAuditUpdate,
    QmsIsoClauseComplianceSummary,
    QmsIsoClauseCreate,
    QmsIsoClauseListResponse,
    QmsIsoClauseLoadPresetResult,
    QmsIsoClauseRelatedAuditsResponse,
    QmsIsoClauseRelatedDocumentsResponse,
    QmsIsoClauseResponse,
    QmsIsoClauseTreeNode,
    QmsIsoClauseUpdate,
    QmsManagementReviewCreate,
    QmsManagementReviewListResponse,
    QmsManagementReviewResponse,
    QmsManagementReviewUpdate,
    QmsManagementReviewInputSummary,
    QmsSystemDocumentCreate,
    QmsSystemDocumentListResponse,
    QmsSystemDocumentResponse,
    QmsSystemDocumentReviewDueSummary,
    QmsSystemDocumentUpdate,
)
from apps.kuaizhizao.services.qms_iso_clause_service import iso_clause_service
from apps.kuaizhizao.services.quality_qms_service import (
    QmsInternalAuditService,
    QmsManagementReviewService,
    QmsSystemDocumentService,
)
from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_access
from infra.models.user import User

router = APIRouter(tags=["App - Kuaige Zhizao - Quality System"])

doc_service = QmsSystemDocumentService()
audit_service = QmsInternalAuditService()
review_service = QmsManagementReviewService()

_DOC_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-system-documents",
        "read",
        required_permissions=["kuaizhizao:quality-management-system-documents:read"],
    )
)
_DOC_CREATE = Depends(
    require_access(
        "kuaizhizao.quality-management-system-documents",
        "create",
        required_permissions=["kuaizhizao:quality-management-system-documents:create"],
    )
)
_DOC_UPDATE = Depends(
    require_access(
        "kuaizhizao.quality-management-system-documents",
        "update",
        required_permissions=["kuaizhizao:quality-management-system-documents:update"],
    )
)
_DOC_DELETE = Depends(
    require_access(
        "kuaizhizao.quality-management-system-documents",
        "delete",
        required_permissions=["kuaizhizao:quality-management-system-documents:delete"],
    )
)
_DOC_PUBLISH = Depends(
    require_access(
        "kuaizhizao.quality-management-system-documents",
        "publish",
        required_permissions=["kuaizhizao:quality-management-system-documents:publish"],
    )
)
_DOC_OBSOLETE = Depends(
    require_access(
        "kuaizhizao.quality-management-system-documents",
        "obsolete",
        required_permissions=["kuaizhizao:quality-management-system-documents:obsolete"],
    )
)

_AUDIT_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-internal-audits",
        "read",
        required_permissions=["kuaizhizao:quality-management-internal-audits:read"],
    )
)
_AUDIT_CREATE = Depends(
    require_access(
        "kuaizhizao.quality-management-internal-audits",
        "create",
        required_permissions=["kuaizhizao:quality-management-internal-audits:create"],
    )
)
_AUDIT_UPDATE = Depends(
    require_access(
        "kuaizhizao.quality-management-internal-audits",
        "update",
        required_permissions=["kuaizhizao:quality-management-internal-audits:update"],
    )
)
_AUDIT_DELETE = Depends(
    require_access(
        "kuaizhizao.quality-management-internal-audits",
        "delete",
        required_permissions=["kuaizhizao:quality-management-internal-audits:delete"],
    )
)

_REVIEW_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-management-reviews",
        "read",
        required_permissions=["kuaizhizao:quality-management-management-reviews:read"],
    )
)
_REVIEW_CREATE = Depends(
    require_access(
        "kuaizhizao.quality-management-management-reviews",
        "create",
        required_permissions=["kuaizhizao:quality-management-management-reviews:create"],
    )
)
_REVIEW_UPDATE = Depends(
    require_access(
        "kuaizhizao.quality-management-management-reviews",
        "update",
        required_permissions=["kuaizhizao:quality-management-management-reviews:update"],
    )
)
_REVIEW_DELETE = Depends(
    require_access(
        "kuaizhizao.quality-management-management-reviews",
        "delete",
        required_permissions=["kuaizhizao:quality-management-management-reviews:delete"],
    )
)

_CLAUSE_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-iso-clauses",
        "read",
        required_permissions=["kuaizhizao:quality-management-iso-clauses:read"],
    )
)
_CLAUSE_CREATE = Depends(
    require_access(
        "kuaizhizao.quality-management-iso-clauses",
        "create",
        required_permissions=["kuaizhizao:quality-management-iso-clauses:create"],
    )
)
_CLAUSE_UPDATE = Depends(
    require_access(
        "kuaizhizao.quality-management-iso-clauses",
        "update",
        required_permissions=["kuaizhizao:quality-management-iso-clauses:update"],
    )
)
_CLAUSE_DELETE = Depends(
    require_access(
        "kuaizhizao.quality-management-iso-clauses",
        "delete",
        required_permissions=["kuaizhizao:quality-management-iso-clauses:delete"],
    )
)
_CLAUSE_EXPORT = Depends(
    require_access(
        "kuaizhizao.quality-management-iso-clauses",
        "export",
        required_permissions=["kuaizhizao:quality-management-iso-clauses:export"],
    )
)


@router.post("/qms/system-documents", response_model=QmsSystemDocumentResponse, summary="Create system document")
async def create_system_document(
    payload: QmsSystemDocumentCreate,
    _auth=_DOC_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsSystemDocumentResponse:
    return await doc_service.create_document(tenant_id=tenant_id, payload=payload)


@router.get("/qms/system-documents", response_model=QmsSystemDocumentListResponse, summary="List system documents")
async def list_system_documents(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    _auth=_DOC_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsSystemDocumentListResponse:
    return await doc_service.list_documents(
        tenant_id=tenant_id,
        keyword=keyword,
        status=status,
        doc_type=doc_type,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/qms/system-documents/review-due-summary",
    response_model=QmsSystemDocumentReviewDueSummary,
    summary="Count system documents due for review",
)
async def get_system_document_review_due_summary(
    _auth=_DOC_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsSystemDocumentReviewDueSummary:
    return await doc_service.count_review_due_documents(tenant_id=tenant_id)


@router.get(
    "/qms/system-documents/{document_id}",
    response_model=QmsSystemDocumentResponse,
    summary="Get system document",
)
async def get_system_document(
    document_id: int,
    _auth=_DOC_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsSystemDocumentResponse:
    return await doc_service.get_document(tenant_id=tenant_id, document_id=document_id)


@router.put(
    "/qms/system-documents/{document_id}",
    response_model=QmsSystemDocumentResponse,
    summary="Update system document",
)
async def update_system_document(
    document_id: int,
    payload: QmsSystemDocumentUpdate,
    _auth=_DOC_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsSystemDocumentResponse:
    return await doc_service.update_document(tenant_id=tenant_id, document_id=document_id, payload=payload)


@router.post(
    "/qms/system-documents/{document_id}/publish",
    response_model=QmsSystemDocumentResponse,
    summary="Publish system document",
)
async def publish_system_document(
    document_id: int,
    _auth=_DOC_PUBLISH,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsSystemDocumentResponse:
    return await doc_service.publish_document(tenant_id=tenant_id, document_id=document_id)


@router.post(
    "/qms/system-documents/{document_id}/obsolete",
    response_model=QmsSystemDocumentResponse,
    summary="Obsolete system document",
)
async def obsolete_system_document(
    document_id: int,
    _auth=_DOC_OBSOLETE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsSystemDocumentResponse:
    return await doc_service.obsolete_document(tenant_id=tenant_id, document_id=document_id)


@router.delete("/qms/system-documents/{document_id}", summary="Delete system document")
async def delete_system_document(
    document_id: int,
    _auth=_DOC_DELETE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    await doc_service.delete_document(tenant_id=tenant_id, document_id=document_id)
    return {"success": True}


@router.post("/qms/internal-audits", response_model=QmsInternalAuditResponse, summary="Create internal audit")
async def create_internal_audit(
    payload: QmsInternalAuditCreate,
    _auth=_AUDIT_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsInternalAuditResponse:
    return await audit_service.create_audit(tenant_id=tenant_id, payload=payload)


@router.get("/qms/internal-audits", response_model=QmsInternalAuditListResponse, summary="List internal audits")
async def list_internal_audits(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    _auth=_AUDIT_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsInternalAuditListResponse:
    return await audit_service.list_audits(
        tenant_id=tenant_id, keyword=keyword, status=status, skip=skip, limit=limit
    )


@router.get("/qms/internal-audits/{audit_id}", response_model=QmsInternalAuditResponse, summary="Get internal audit")
async def get_internal_audit(
    audit_id: int,
    _auth=_AUDIT_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsInternalAuditResponse:
    return await audit_service.get_audit(tenant_id=tenant_id, audit_id=audit_id)


@router.put(
    "/qms/internal-audits/{audit_id}",
    response_model=QmsInternalAuditResponse,
    summary="Update internal audit",
)
async def update_internal_audit(
    audit_id: int,
    payload: QmsInternalAuditUpdate,
    _auth=_AUDIT_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsInternalAuditResponse:
    return await audit_service.update_audit(tenant_id=tenant_id, audit_id=audit_id, payload=payload)


@router.delete("/qms/internal-audits/{audit_id}", summary="Delete internal audit")
async def delete_internal_audit(
    audit_id: int,
    _auth=_AUDIT_DELETE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    await audit_service.delete_audit(tenant_id=tenant_id, audit_id=audit_id)
    return {"success": True}


@router.post(
    "/qms/management-reviews",
    response_model=QmsManagementReviewResponse,
    summary="Create management review",
)
async def create_management_review(
    payload: QmsManagementReviewCreate,
    _auth=_REVIEW_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsManagementReviewResponse:
    return await review_service.create_review(tenant_id=tenant_id, payload=payload)


@router.get(
    "/qms/management-reviews",
    response_model=QmsManagementReviewListResponse,
    summary="List management reviews",
)
async def list_management_reviews(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    _auth=_REVIEW_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsManagementReviewListResponse:
    return await review_service.list_reviews(
        tenant_id=tenant_id, keyword=keyword, status=status, skip=skip, limit=limit
    )


@router.get(
    "/qms/management-reviews/input-summary",
    response_model=QmsManagementReviewInputSummary,
    summary="Aggregate management review input metrics",
)
async def get_management_review_input_summary(
    period_start: Optional[datetime] = Query(None, description="统计起始（站点墙钟）"),
    period_end: Optional[datetime] = Query(None, description="统计截止（站点墙钟）"),
    _auth=_REVIEW_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsManagementReviewInputSummary:
    return await review_service.get_input_summary(
        tenant_id=tenant_id,
        period_start=period_start,
        period_end=period_end,
    )


@router.get(
    "/qms/management-reviews/{review_id}",
    response_model=QmsManagementReviewResponse,
    summary="Get management review",
)
async def get_management_review(
    review_id: int,
    _auth=_REVIEW_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsManagementReviewResponse:
    return await review_service.get_review(tenant_id=tenant_id, review_id=review_id)


@router.put(
    "/qms/management-reviews/{review_id}",
    response_model=QmsManagementReviewResponse,
    summary="Update management review",
)
async def update_management_review(
    review_id: int,
    payload: QmsManagementReviewUpdate,
    _auth=_REVIEW_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsManagementReviewResponse:
    return await review_service.update_review(tenant_id=tenant_id, review_id=review_id, payload=payload)


@router.delete("/qms/management-reviews/{review_id}", summary="Delete management review")
async def delete_management_review(
    review_id: int,
    _auth=_REVIEW_DELETE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    await review_service.delete_review(tenant_id=tenant_id, review_id=review_id)
    return {"success": True}


@router.post("/qms/iso-clauses", response_model=QmsIsoClauseResponse, summary="Create ISO clause")
async def create_iso_clause(
    payload: QmsIsoClauseCreate,
    _auth=_CLAUSE_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseResponse:
    return await iso_clause_service.create_clause(tenant_id=tenant_id, payload=payload, user=current_user)


@router.get("/qms/iso-clauses", response_model=QmsIsoClauseListResponse, summary="List ISO clauses")
async def list_iso_clauses(
    standard_code: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    _auth=_CLAUSE_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseListResponse:
    return await iso_clause_service.list_clauses(
        tenant_id=tenant_id,
        standard_code=standard_code,
        keyword=keyword,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.get("/qms/iso-clauses/tree", response_model=list[QmsIsoClauseTreeNode], summary="ISO clause tree")
async def list_iso_clause_tree(
    standard_code: Optional[str] = Query(None),
    _auth=_CLAUSE_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> list[QmsIsoClauseTreeNode]:
    return await iso_clause_service.list_tree(tenant_id=tenant_id, standard_code=standard_code)


@router.post(
    "/qms/iso-clauses/load-preset",
    response_model=QmsIsoClauseLoadPresetResult,
    summary="Load ISO 9001:2015 preset clauses",
)
async def load_iso_clause_preset(
    standard_code: str = Query("ISO9001:2015"),
    _auth=_CLAUSE_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseLoadPresetResult:
    return await iso_clause_service.load_preset(
        tenant_id=tenant_id, standard_code=standard_code, user=current_user
    )


@router.get("/qms/iso-clauses/{clause_id}", response_model=QmsIsoClauseResponse, summary="Get ISO clause")
async def get_iso_clause(
    clause_id: int,
    _auth=_CLAUSE_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseResponse:
    return await iso_clause_service.get_clause(tenant_id=tenant_id, clause_id=clause_id)


@router.put("/qms/iso-clauses/{clause_id}", response_model=QmsIsoClauseResponse, summary="Update ISO clause")
async def update_iso_clause(
    clause_id: int,
    payload: QmsIsoClauseUpdate,
    _auth=_CLAUSE_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseResponse:
    return await iso_clause_service.update_clause(
        tenant_id=tenant_id, clause_id=clause_id, payload=payload, user=current_user
    )


@router.delete("/qms/iso-clauses/{clause_id}", summary="Delete ISO clause")
async def delete_iso_clause(
    clause_id: int,
    _auth=_CLAUSE_DELETE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    await iso_clause_service.delete_clause(tenant_id=tenant_id, clause_id=clause_id)
    return {"success": True}


@router.get(
    "/qms/iso-clauses/{clause_id}/compliance-summary",
    response_model=QmsIsoClauseComplianceSummary,
    summary="ISO clause compliance summary",
)
async def get_iso_clause_compliance_summary(
    clause_id: int,
    _auth=_CLAUSE_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseComplianceSummary:
    return await iso_clause_service.get_compliance_summary(tenant_id=tenant_id, clause_id=clause_id)


@router.get(
    "/qms/iso-clauses/{clause_id}/related-documents",
    response_model=QmsIsoClauseRelatedDocumentsResponse,
    summary="Related system documents for ISO clause",
)
async def list_iso_clause_related_documents(
    clause_id: int,
    limit: int = Query(50, ge=1, le=200),
    _auth=_CLAUSE_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseRelatedDocumentsResponse:
    items = await iso_clause_service.list_related_documents(
        tenant_id=tenant_id, clause_id=clause_id, limit=limit
    )
    return QmsIsoClauseRelatedDocumentsResponse(items=items)


@router.get(
    "/qms/iso-clauses/{clause_id}/related-audits",
    response_model=QmsIsoClauseRelatedAuditsResponse,
    summary="Related internal audits for ISO clause",
)
async def list_iso_clause_related_audits(
    clause_id: int,
    limit: int = Query(50, ge=1, le=200),
    _auth=_CLAUSE_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QmsIsoClauseRelatedAuditsResponse:
    items = await iso_clause_service.list_related_audits(
        tenant_id=tenant_id, clause_id=clause_id, limit=limit
    )
    return QmsIsoClauseRelatedAuditsResponse(items=items)
