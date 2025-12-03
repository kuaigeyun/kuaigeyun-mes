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
    preview_url: Optional[str] = Field(None, max_length=500, description="预览URL（kkFileView 或简单预览）")
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


class FilePreviewResponse(BaseModel):
    """
    文件预览响应 Schema
    
    用于返回文件预览信息。
    """
    preview_mode: str = Field(..., description="预览模式（simple 或 kkfileview）")
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

