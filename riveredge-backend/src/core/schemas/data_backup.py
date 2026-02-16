"""
数据备份 Schema 模块
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class DataBackupBase(BaseModel):
    name: str = Field(..., description="备份名称")
    backup_type: str = Field("full", description="备份类型 (full, incremental)")
    backup_scope: str = Field("all", description="备份范围 (all, tenant, table)")
    backup_tables: Optional[List[str]] = Field(None, description="备份的表列表")


class DataBackupCreate(DataBackupBase):
    pass


class DataBackupResponse(DataBackupBase):
    uuid: str
    tenant_id: Optional[int]
    file_path: Optional[str] = None
    file_uuid: Optional[str] = None
    file_size: Optional[int] = None
    status: str
    inngest_run_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DataBackupListResponse(BaseModel):
    items: List[DataBackupResponse]
    total: int
    page: int
    page_size: int
