"""
数据备份 Schema 模块
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class DataBackupBase(BaseModel):
    name: str = Field(..., description="备份名称")
    backup_type: str = Field("full", description="备份类型 (full, incremental)")
    backup_scope: str = Field("all", description="备份范围 (all, tenant, table)")
    include_files: bool = Field(
        True,
        description="是否包含 uploads 附件（false=仅数据表，可减小备份包体积）",
    )
    backup_tables: Optional[List[str]] = Field(None, description="备份的表列表")


class DataBackupCreate(DataBackupBase):
    target_tenant_id: Optional[int] = Field(
        None,
        description="租户级备份的目标组织 ID；平台管理员未绑定租户时可指定",
    )
    trigger_source: str = Field(
        "manual",
        description="触发来源：manual=手动，scheduled=定时策略",
    )


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
    trigger_source: str = "manual"
    storage_backend: str = "local"
    storage_connection_uuid: Optional[str] = None
    storage_key: Optional[str] = None
    storage_owner_tenant_id: Optional[int] = None
    storage_label: Optional[str] = Field(
        None,
        description="存储位置展示：本机 / 腾讯云 COS / MinIO / RustFS",
    )
    status: str
    progress: int = Field(0, description="备份进度百分比 0-100")
    progress_message: Optional[str] = Field(None, description="备份进度说明")
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


class DataBackupStorageSettings(BaseModel):
    backend: str = Field("local", description="local 或 connection")
    connection_uuid: Optional[str] = None
    key_prefix: str = "data-backups"
    storage_owner_tenant_id: Optional[int] = None


class DataBackupRetentionSettings(BaseModel):
    mode: str = Field("none", description="none / days / keep_count")
    days: int = 30
    keep_count: int = 7


class DataBackupPolicy(BaseModel):
    schedule_enabled: bool = False
    cron: str = "0 2 * * *"
    include_files: bool = True
    storage: DataBackupStorageSettings = Field(default_factory=DataBackupStorageSettings)
    retention: DataBackupRetentionSettings = Field(default_factory=DataBackupRetentionSettings)
    last_scheduled_at: Optional[str] = None
    last_retention_at: Optional[str] = None


class DataBackupPolicyUpdate(BaseModel):
    schedule_enabled: Optional[bool] = None
    cron: Optional[str] = None
    include_files: Optional[bool] = None
    storage: Optional[Dict[str, Any]] = None
    retention: Optional[Dict[str, Any]] = None


class DataBackupStorageConnectionItem(BaseModel):
    uuid: str
    name: Optional[str] = None
    code: Optional[str] = None
    type: str
    type_label: str


class DataBackupStorageConnectionList(BaseModel):
    items: List[DataBackupStorageConnectionItem]
