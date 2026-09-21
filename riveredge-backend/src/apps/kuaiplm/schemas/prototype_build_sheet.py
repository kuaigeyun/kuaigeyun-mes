"""样机制作书 Schema（研发项目 §2.15）"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PrototypeBuildAttachment(BaseModel):
    file_uuid: str = Field(..., min_length=1, max_length=36)
    file_name: Optional[str] = Field(None, max_length=200)
    media_kind: str = Field(default="file", description="text/image/file")


class PrototypeBuildSheetCreate(BaseModel):
    project_id: int
    title: str = Field(..., min_length=1, max_length=200)
    sheet_code: Optional[str] = Field(None, max_length=50)
    round_key: str = Field(default="t1", max_length=20)
    project_requirements: Optional[str] = None
    project_attachments: List[PrototypeBuildAttachment] = Field(default_factory=list)
    remarks: Optional[str] = None


class PrototypeBuildSheetUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    project_requirements: Optional[str] = None
    project_attachments: Optional[List[PrototypeBuildAttachment]] = None
    remarks: Optional[str] = None


class PrototypeBuildSectionUpdate(BaseModel):
    requirements: Optional[str] = None
    attachments: List[PrototypeBuildAttachment] = Field(default_factory=list)


class PrototypeBuildSignoffUpdate(BaseModel):
    manufacturing_opinion: Optional[str] = None
    quality_opinion: Optional[str] = None


class PrototypeBuildSheetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: UUID
    sheet_code: str
    project_id: int
    project_code: str
    project_name: str
    round_key: str
    title: str
    status: str
    project_requirements: Optional[str] = None
    project_attachments: List[dict] = Field(default_factory=list)
    electronics_requirements: Optional[str] = None
    electronics_attachments: List[dict] = Field(default_factory=list)
    electronics_status: str
    structure_requirements: Optional[str] = None
    structure_attachments: List[dict] = Field(default_factory=list)
    structure_status: str
    manufacturing_opinion: Optional[str] = None
    quality_opinion: Optional[str] = None
    remarks: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None


class PrototypeBuildSheetListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: UUID
    sheet_code: str
    project_id: int
    project_code: str
    project_name: str
    round_key: str
    title: str
    status: str
    electronics_status: str
    structure_status: str
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class PrototypeBuildSheetListResponse(BaseModel):
    items: List[PrototypeBuildSheetListItem]
    total: int
