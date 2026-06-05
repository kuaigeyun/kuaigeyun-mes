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
    source_tenant_id: Optional[int] = Field(
        None,
        description="备份文件内记录的导出租户 ID（来自 backup_metadata.json，用于恢复时展示与映射）",
    )
    file_available: Optional[bool] = Field(
        None,
        description="本服务器上备份 zip 是否可访问（备份文件仅存于创建/上传所在服务器）",
    )
    file_uuid: Optional[str] = None
    file_size: Optional[int] = None
    source_type: str = "generated"
    status: str
    inngest_run_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    restore_status: Optional[str] = None
    restore_started_at: Optional[datetime] = None
    restore_completed_at: Optional[datetime] = None
    restore_error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DataBackupListResponse(BaseModel):
    items: List[DataBackupResponse]
    total: int
    page: int
    page_size: int
