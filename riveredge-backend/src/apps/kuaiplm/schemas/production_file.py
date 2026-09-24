"""生产文件中心 Schema（R-06）。"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductionFileCreate(BaseModel):
    catalog_kind: str = Field(..., description="pe_production / rd_tool")
    file_type: str = Field(..., min_length=1, max_length=40)
    title: str = Field(..., min_length=1, max_length=200)
    version: str = Field("A0", min_length=1, max_length=30)
    file_code: Optional[str] = Field(None, max_length=50)
    process_code: Optional[str] = Field(None, max_length=80)
    process_name: Optional[str] = Field(None, max_length=200)
    product_model: Optional[str] = Field(None, max_length=120)
    project_id: Optional[int] = Field(None, description="研发项目ID（与 project_code 二选一或皆空）")
    project_code: Optional[str] = Field(None, max_length=50, description="项目代号（存量项目手填）")
    project_name: Optional[str] = Field(None, max_length=200, description="项目名称（手填时可空，默认同代号）")
    release_date: Optional[date] = None
    file_uuid: Optional[str] = Field(None, max_length=36)
    file_name: Optional[str] = Field(None, max_length=200)
    checksum: Optional[str] = Field(None, max_length=128)
    change_summary: Optional[str] = None
    remarks: Optional[str] = None


class ProductionFileUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    file_type: Optional[str] = Field(None, min_length=1, max_length=40)
    process_code: Optional[str] = Field(None, max_length=80)
    process_name: Optional[str] = Field(None, max_length=200)
    product_model: Optional[str] = Field(None, max_length=120)
    release_date: Optional[date] = None
    file_uuid: Optional[str] = Field(None, max_length=36)
    file_name: Optional[str] = Field(None, max_length=200)
    checksum: Optional[str] = Field(None, max_length=128)
    change_summary: Optional[str] = None
    remarks: Optional[str] = None
    version: Optional[str] = Field(None, min_length=1, max_length=30)


class ProductionFileReviseRequest(BaseModel):
    version: Optional[str] = Field(None, max_length=30)
    change_summary: Optional[str] = None
    file_uuid: Optional[str] = Field(None, max_length=36)
    file_name: Optional[str] = Field(None, max_length=200)
    checksum: Optional[str] = Field(None, max_length=128)
    release_date: Optional[date] = None
    title: Optional[str] = Field(None, max_length=200)


class ProductionFileIssueRequest(BaseModel):
    receiver_names: str = Field(..., min_length=1, max_length=500)
    remark: Optional[str] = Field(None, max_length=500)
    version_id: Optional[int] = None


class ProductionFileAccessRequest(BaseModel):
    action: str = Field(..., description="view / download")
    version_id: Optional[int] = None
    remark: Optional[str] = Field(None, max_length=500)


class ProductionFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    id: int
    file_code: str
    catalog_kind: str
    file_type: str
    title: str
    process_code: Optional[str] = None
    process_name: Optional[str] = None
    product_model: Optional[str] = None
    project_id: Optional[int] = None
    project_code: Optional[str] = None
    project_name: Optional[str] = None
    release_date: Optional[date] = None
    version: str
    status: str
    file_uuid: Optional[str] = None
    file_name: Optional[str] = None
    checksum: Optional[str] = None
    change_summary: Optional[str] = None
    remarks: Optional[str] = None
    issued_by: Optional[int] = None
    issued_by_name: Optional[str] = None
    issued_at: Optional[datetime] = None
    receiver_names: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    obsolete_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None


class ProductionFileListResponse(BaseModel):
    items: List[ProductionFileResponse]
    total: int


class ProductionFileVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    id: int
    file_id: int
    file_code: str
    version: str
    status: str
    is_effective: bool
    is_production_effective: bool
    title: str
    file_type: Optional[str] = None
    release_date: Optional[date] = None
    file_uuid: Optional[str] = None
    file_name: Optional[str] = None
    checksum: Optional[str] = None
    change_summary: Optional[str] = None
    effective_at: Optional[datetime] = None
    obsolete_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None


class ProductionFileVersionListResponse(BaseModel):
    items: List[ProductionFileVersionResponse]
    total: int
    audience: str
    can_view_history: bool


class ProductionFileAccessLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    id: int
    file_id: int
    file_code: str
    version_id: Optional[int] = None
    version: Optional[str] = None
    action: str
    actor_user_id: Optional[int] = None
    actor_name: Optional[str] = None
    receiver_names: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime


class ProductionFileAccessLogListResponse(BaseModel):
    items: List[ProductionFileAccessLogResponse]
    total: int


class ProductionFileDownloadResponse(BaseModel):
    preview_url: str = Field(..., description="带 token 的下载预览 URL")
    file_name: Optional[str] = Field(None, description="文件名快照")
    version_id: Optional[int] = Field(None, description="版本行 ID")
