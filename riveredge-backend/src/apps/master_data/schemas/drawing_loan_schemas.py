"""图档借阅与密级授权 Schema"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DrawingLoanLineInput(BaseModel):
    drawing_uuid: str = Field(..., alias="drawingUuid")

    model_config = ConfigDict(populate_by_name=True)


class DrawingLoanLineResponse(BaseModel):
    id: int
    drawing_id: int = Field(..., alias="drawingId")
    drawing_uuid: str = Field(..., alias="drawingUuid")
    drawing_code: str = Field(..., alias="drawingCode")
    drawing_name: str = Field(..., alias="drawingName")
    drawing_revision: str = Field(..., alias="drawingRevision")
    security_level: str = Field(..., alias="securityLevel")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DrawingLoanCreate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., max_length=200)
    purpose: Optional[str] = Field(None, max_length=500)
    due_at: datetime = Field(..., alias="dueAt")
    lines: List[DrawingLoanLineInput] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        name = (v or "").strip()
        if not name:
            raise ValueError("借阅单名称不能为空")
        return name


class DrawingLoanUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    purpose: Optional[str] = Field(None, max_length=500)
    due_at: Optional[datetime] = Field(None, alias="dueAt")
    lines: Optional[List[DrawingLoanLineInput]] = None

    model_config = ConfigDict(populate_by_name=True)


class DrawingLoanResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    code: str
    name: str
    purpose: Optional[str] = None
    due_at: datetime = Field(..., alias="dueAt")
    status: str
    returned_at: Optional[datetime] = Field(None, alias="returnedAt")
    returned_by_name: Optional[str] = Field(None, alias="returnedByName")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    lines: List[DrawingLoanLineResponse] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DrawingLoanListResponse(BaseModel):
    data: List[DrawingLoanResponse] = Field(default_factory=list)
    total: int = 0


class DrawingClearanceUpsert(BaseModel):
    user_id: int = Field(..., alias="userId")
    security_level: str = Field(..., alias="securityLevel")

    model_config = ConfigDict(populate_by_name=True)


class DrawingClearanceResponse(BaseModel):
    user_id: int = Field(..., alias="userId")
    user_name: str = Field(..., alias="userName")
    security_level: str = Field(..., alias="securityLevel")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DrawingClearanceListResponse(BaseModel):
    data: List[DrawingClearanceResponse] = Field(default_factory=list)
    total: int = 0
