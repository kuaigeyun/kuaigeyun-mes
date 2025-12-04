"""
数据备份 Schema 模块

定义数据备份相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class DataBackupBase(BaseModel):
    """数据备份基础 Schema"""
    name: str = Field(..., description="备份名称")
    backup_type: str = Field(..., description="备份类型（full-全量、incremental-增量）")
    backup_scope: str = Field(..., description="备份范围（all-全部、tenant-组织、table-表）")
    backup_tables: Optional[List[str]] = Field(None, description="备份表列表（如果 scope 为 table）")


class DataBackupCreate(DataBackupBase):
    """创建数据备份 Schema"""
    pass


class DataBackupUpdate(BaseModel):
    """更新数据备份 Schema"""
    name: Optional[str] = Field(None, description="备份名称")
    status: Optional[str] = Field(None, description="备份状态")
    file_path: Optional[str] = Field(None, description="备份文件路径")
    file_uuid: Optional[str] = Field(None, description="备份文件UUID")
    file_size: Optional[int] = Field(None, description="备份文件大小")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    started_at: Optional[datetime] = Field(None, description="备份开始时间")
    completed_at: Optional[datetime] = Field(None, description="备份完成时间")
    error_message: Optional[str] = Field(None, description="错误信息")


class DataBackupResponse(DataBackupBase):
    """数据备份响应 Schema"""
    uuid: UUID = Field(..., description="备份UUID")
    tenant_id: int = Field(..., description="组织ID")
    file_path: Optional[str] = Field(None, description="备份文件路径")
    file_uuid: Optional[str] = Field(None, description="备份文件UUID")
    file_size: Optional[int] = Field(None, description="备份文件大小")
    status: str = Field(..., description="备份状态")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    started_at: Optional[datetime] = Field(None, description="备份开始时间")
    completed_at: Optional[datetime] = Field(None, description="备份完成时间")
    error_message: Optional[str] = Field(None, description="错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class DataBackupListResponse(BaseModel):
    """数据备份列表响应 Schema"""
    items: List[DataBackupResponse] = Field(..., description="备份列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class DataBackupRestoreRequest(BaseModel):
    """恢复备份请求 Schema"""
    confirm: bool = Field(..., description="确认恢复（必须为 true）")


class DataBackupRestoreResponse(BaseModel):
    """恢复备份响应 Schema"""
    success: bool = Field(..., description="是否成功")
    message: Optional[str] = Field(None, description="消息")
    error: Optional[str] = Field(None, description="错误信息")

