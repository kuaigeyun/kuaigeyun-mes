"""
文件管理 Schema 模块

定义文件管理相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class FileBase(BaseModel):
    """
    文件基础 Schema
    
    包含文件的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=255, description="文件名称（存储时使用的文件名，通常是UUID）")
    original_name: str = Field(..., min_length=1, max_length=255, description="原始文件名（用户上传时的文件名）")
    file_path: str = Field(..., min_length=1, max_length=500, description="文件存储路径")
    file_size: int = Field(..., ge=0, description="文件大小（字节）")
    file_type: Optional[str] = Field(None, max_length=100, description="文件类型（MIME类型）")
    file_extension: Optional[str] = Field(None, max_length=20, description="文件扩展名")
    preview_url: Optional[str] = Field(None, max_length=500, description="预览用下载 URL（含 token）")
    category: Optional[str] = Field(None, max_length=50, description="文件分类（可选）")
    tags: Optional[List[str]] = Field(None, description="文件标签（JSON数组，可选）")
    description: Optional[str] = Field(None, description="文件描述（可选）")
    is_active: bool = Field(default=True, description="是否启用")
    upload_status: str = Field(default="completed", max_length=20, description="上传状态（uploading、completed、failed）")


class FileCreate(FileBase):
    """
    文件创建 Schema
    
    用于创建新文件的请求数据。
    注意：通常由上传接口自动创建，不需要手动调用。
    """
    pass


class FileUpdate(BaseModel):
    """
    文件更新 Schema
    
    用于更新文件的请求数据，所有字段可选。
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="文件名称")
    category: Optional[str] = Field(None, max_length=50, description="文件分类")
    tags: Optional[List[str]] = Field(None, description="文件标签")
    description: Optional[str] = Field(None, description="文件描述")
    is_active: Optional[bool] = Field(None, description="是否启用")


class FileResponse(FileBase):
    """
    文件响应 Schema
    
    用于返回文件信息。
    """
    uuid: UUID = Field(..., description="文件UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    storage_backend: Optional[str] = Field(default="local", description="存储后端：local / tencent_cos")
    storage_connection_uuid: Optional[str] = Field(None, description="对象存储连接 UUID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class FileListResponse(BaseModel):
    """
    文件列表响应 Schema
    
    用于返回文件列表（分页）。
    """
    items: List[FileResponse] = Field(..., description="文件列表")
    total: int = Field(..., ge=0, description="总数")
    page: int = Field(..., ge=1, description="当前页")
    page_size: int = Field(..., ge=1, description="每页数量")
    non_empty_attachment_categories: Optional[List[str]] = Field(
        None,
        description="有文件的 attachment category（含业务表引用、category 未写入 core_files 的情况）",
    )


class FilePreviewResponse(BaseModel):
    """
    文件预览响应 Schema
    
    用于返回文件预览信息。
    """
    preview_mode: str = Field(default="simple", description="预览模式（固定为浏览器直连下载预览）")
    preview_url: str = Field(..., description="预览URL")
    file_type: Optional[str] = Field(None, description="文件类型")
    supported: bool = Field(..., description="是否支持预览")


class FileUploadResponse(BaseModel):
    """
    文件上传响应 Schema
    
    用于返回文件上传结果。
    """
    uuid: UUID = Field(..., description="文件UUID")
    name: str = Field(..., description="文件名称")
    original_name: str = Field(..., description="原始文件名")
    file_size: int = Field(..., description="文件大小（字节）")
    file_type: Optional[str] = Field(None, description="文件类型")
    file_extension: Optional[str] = Field(None, description="文件扩展名")
    file_path: str = Field(..., description="文件存储路径")


class ImageTierBackfillResponse(BaseModel):
    """存量图片三档压缩批次结果"""

    total_images: int = Field(..., description="符合条件的图片总数")
    batch_size: int = Field(..., description="本批次处理条数")
    processed: int = Field(..., description="成功处理数")
    generated: int = Field(..., description="本批次新生成档位数>0的文件数")
    skipped: int = Field(..., description="跳过数（已有档位或不可处理）")
    failed: int = Field(..., description="失败数")
    next_offset: int = Field(..., description="下一批次 offset")
    remaining: int = Field(..., description="剩余未扫描条数（估算）")
    done: bool = Field(..., description="是否已全部处理完成")
    errors: List[str] = Field(default_factory=list, description="错误摘要（最多20条）")


class FileStorageSettings(BaseModel):
    """文件存储位置设置（租户级）"""

    backend: str = Field(default="local", description="local | connection")
    connection_uuid: Optional[str] = Field(None, description="对象存储应用连接 UUID")
    key_prefix: str = Field(default="", description="对象 Key 环境前缀，如 dev / prod")
    delete_local_after_migrate: bool = Field(
        default=True,
        description="迁移成功后是否删除本地文件",
    )


class FileStorageMigrateRequest(BaseModel):
    """本地文件迁移到 COS 的分页请求"""

    connection_uuid: Optional[str] = Field(None, description="目标 COS 连接；缺省用当前存储设置")
    dry_run: bool = Field(default=False, description="仅统计不写数据")
    cursor: int = Field(default=0, ge=0, description="上一批最大文件 id；首批传 0")
    limit: int = Field(default=50, ge=1, le=100, description="每批条数")


class FileStorageMigrateFailure(BaseModel):
    uuid: str = Field(..., description="文件 UUID")
    reason: str = Field(..., description="失败原因")


class FileStorageMigrateResponse(BaseModel):
    """本地→COS 迁移批次结果（前端循环直至 done）"""

    total: int = Field(..., description="当前仍为本地存储的文件总数（本环境）")
    cursor: int = Field(..., description="本批起始游标")
    next_cursor: int = Field(..., description="下一批游标（文件 id）")
    limit: int = Field(..., description="本批 limit")
    done: bool = Field(..., description="是否已扫完")
    migrated: int = Field(..., description="本批成功迁移（或 dry_run 可迁）数")
    skipped: int = Field(..., description="本批跳过数")
    failed: int = Field(..., description="本批失败数")
    failures: List[FileStorageMigrateFailure] = Field(default_factory=list)
    dry_run: bool = Field(default=False)
    connection_uuid: str = Field(..., description="实际使用的目标连接 UUID")
    target_bucket: Optional[str] = Field(None, description="目标桶名（便于核对控制台）")
    target_endpoint: Optional[str] = Field(None, description="目标桶访问域名")

