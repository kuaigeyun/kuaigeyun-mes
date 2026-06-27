"""audit_record_enricher：audit 须声明在响应 schema 中方可序列化到 API。"""

from datetime import datetime

from pydantic import BaseModel

from core.schemas.base import BaseSchema
from core.services.approval.audit_record_enricher import _apply_audit


class _AuditCarrierResponse(BaseSchema):
    id: int
    status: str
    review_status: str
    created_at: datetime
    updated_at: datetime


class _PlainResponse(BaseModel):
    id: int
    status: str
    review_status: str


def _enrich(status: str = "草稿", review_status: str = "PENDING"):
    now = datetime(2026, 1, 1, 12, 0, 0)
    return _apply_audit(
        _AuditCarrierResponse(
            id=1,
            status=status,
            review_status=review_status,
            created_at=now,
            updated_at=now,
        ),
        entity_type="sales_contract",
        enabled=True,
        status_field="status",
        review_status_field="review_status",
    )


def test_apply_audit_serializes_on_base_schema_response():
    enriched = _enrich()
    assert enriched.audit is not None
    assert enriched.audit["phase"] == "draft"
    assert enriched.model_dump().get("audit", {}).get("phase") == "draft"


def test_apply_audit_not_in_api_dump_without_declared_field():
    now = datetime(2026, 1, 1, 12, 0, 0)
    enriched = _apply_audit(
        _PlainResponse(id=1, status="草稿", review_status="PENDING"),
        entity_type="sales_contract",
        enabled=True,
        status_field="status",
        review_status_field="review_status",
    )
    assert enriched.model_dump().get("audit") is None
