"""图档发放 Schema"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DrawingDistributionLineInput(BaseModel):
    drawing_uuid: str = Field(..., alias="drawingUuid")

    model_config = ConfigDict(populate_by_name=True)


class DrawingDistributionLineResponse(BaseModel):
    id: int
    drawing_id: int = Field(..., alias="drawingId")
    drawing_uuid: str = Field(..., alias="drawingUuid")
    drawing_code: str = Field(..., alias="drawingCode")
    drawing_name: str = Field(..., alias="drawingName")
    drawing_revision: str = Field(..., alias="drawingRevision")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DrawingDistributionCreate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., max_length=200)
    remark: Optional[str] = None
    lines: List[DrawingDistributionLineInput] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        name = (v or "").strip()
        if not name:
            raise ValueError("发放单名称不能为空")
        return name


class DrawingDistributionUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    remark: Optional[str] = None
    lines: Optional[List[DrawingDistributionLineInput]] = None

    model_config = ConfigDict(populate_by_name=True)


class DrawingDistributionRecallRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000)

    model_config = ConfigDict(populate_by_name=True)


class DrawingDistributionResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    code: str
    name: str
    status: str
    remark: Optional[str] = None
    issued_at: Optional[datetime] = Field(None, alias="issuedAt")
    issued_by_name: Optional[str] = Field(None, alias="issuedByName")
    recalled_at: Optional[datetime] = Field(None, alias="recalledAt")
    recalled_by_name: Optional[str] = Field(None, alias="recalledByName")
    recall_reason: Optional[str] = Field(None, alias="recallReason")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    lines: List[DrawingDistributionLineResponse] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DrawingDistributionListResponse(BaseModel):
    data: List[DrawingDistributionResponse] = Field(default_factory=list)
    total: int = 0


class DrawingDistributionPolicyResponse(BaseModel):
    is_enabled: bool = Field(..., alias="isEnabled")

    model_config = ConfigDict(populate_by_name=True)


class DrawingDistributionPolicyUpdate(BaseModel):
    is_enabled: bool = Field(..., alias="isEnabled")

    model_config = ConfigDict(populate_by_name=True)
