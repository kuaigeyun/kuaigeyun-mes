"""图纸工程变更 Schema"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

DRAWING_CHANGE_TYPES = {"revision", "file_replace", "obsolete", "metadata", "other"}


class DrawingChangeCreate(BaseModel):
    drawing_uuid: str = Field(..., alias="drawingUuid")
    change_type: str = Field(..., alias="changeType")
    change_reason: Optional[str] = Field(None, alias="changeReason")
    change_content: Optional[Dict[str, Any]] = Field(None, alias="changeContent")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("change_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        val = (v or "").strip()
        if val not in DRAWING_CHANGE_TYPES:
            raise ValueError(f"变更类型无效，允许: {', '.join(sorted(DRAWING_CHANGE_TYPES))}")
        return val


class DrawingChangeResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    drawing_id: int = Field(..., alias="drawingId")
    drawing_uuid: str = Field(..., alias="drawingUuid")
    drawing_code: str = Field(..., alias="drawingCode")
    drawing_name: str = Field(..., alias="drawingName")
    drawing_revision: str = Field(..., alias="drawingRevision")
    change_type: str = Field(..., alias="changeType")
    change_content: Optional[Dict[str, Any]] = Field(None, alias="changeContent")
    change_reason: Optional[str] = Field(None, alias="changeReason")
    status: str
    applicant_id: Optional[int] = Field(None, alias="applicantId")
    approval_comment: Optional[str] = Field(None, alias="approvalComment")
    applied_at: Optional[datetime] = Field(None, alias="appliedAt")
    result_drawing_uuid: Optional[str] = Field(None, alias="resultDrawingUuid")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DrawingChangeListResponse(BaseModel):
    items: List[DrawingChangeResponse] = Field(default_factory=list)
    total: int = 0
