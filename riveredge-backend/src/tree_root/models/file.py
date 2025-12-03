"""
文件模型模块

定义文件数据模型，用于文件管理。
"""

from tortoise import fields
from typing import Optional, List, Dict, Any
from .base import BaseModel


class File(BaseModel):
    """
    文件模型
    
    用于管理组织内的文件，支持文件上传、下载、预览、删除等功能。
    支持多组织隔离，每个组织的文件相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 文件ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 文件名称（存储时使用的文件名，通常是UUID）
        original_name: 原始文件名（用户上传时的文件名）
        file_path: 文件存储路径
        file_size: 文件大小（字节）
        file_type: 文件类型（MIME类型）
        file_extension: 文件扩展名
        preview_url: 预览URL（kkFileView 或简单预览）
        category: 文件分类（可选）
        tags: 文件标签（JSON数组，可选）
        description: 文件描述（可选）
        is_active: 是否启用
        upload_status: 上传状态（uploading、completed、failed）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="文件ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=255, description="文件名称（存储时使用的文件名，通常是UUID）")
    original_name = fields.CharField(max_length=255, description="原始文件名（用户上传时的文件名）")
    file_path = fields.CharField(max_length=500, description="文件存储路径")
    file_size = fields.BigIntField(description="文件大小（字节）")
    file_type = fields.CharField(max_length=100, null=True, description="文件类型（MIME类型）")
    file_extension = fields.CharField(max_length=20, null=True, description="文件扩展名")
    preview_url = fields.CharField(max_length=500, null=True, description="预览URL（kkFileView 或简单预览）")
    
    category = fields.CharField(max_length=50, null=True, description="文件分类（可选）")
    tags = fields.JSONField(null=True, description="文件标签（JSON数组，可选）")
    description = fields.TextField(null=True, description="文件描述（可选）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    upload_status = fields.CharField(max_length=20, default="completed", description="上传状态（uploading、completed、failed）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_files"
        indexes = [
            ("tenant_id",),
            ("category",),
            ("file_type",),
            ("upload_status",),
            ("uuid",),
            ("created_at",),
        ]
    
    def get_tags(self) -> List[str]:
        """
        获取文件标签列表
        
        Returns:
            List[str]: 文件标签列表
        """
        return self.tags or []
    
    def set_tags(self, tags: List[str]) -> None:
        """
        设置文件标签列表
        
        Args:
            tags: 文件标签列表
        """
        self.tags = tags
    
    def __str__(self):
        """字符串表示"""
        return f"{self.original_name} ({self.file_size} bytes)"

