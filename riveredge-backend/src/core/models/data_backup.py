"""
数据备份模型模块

定义数据备份数据模型，用于数据备份管理。
"""

from tortoise import fields
from typing import Optional, List
from .base import BaseModel


class DataBackup(BaseModel):
    """
    数据备份模型
    
    用于管理数据备份任务和备份文件。
    支持多组织隔离，每个组织的备份相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="数据备份ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 备份基本信息
    name = fields.CharField(max_length=200, description="备份名称")
    backup_type = fields.CharField(max_length=20, description="备份类型（full-全量、incremental-增量）")
    backup_scope = fields.CharField(max_length=20, description="备份范围（all-全部、tenant-组织、table-表）")
    backup_tables = fields.JSONField(null=True, description="备份表列表（如果 scope 为 table）")
    
    # 备份文件信息
    file_path = fields.CharField(max_length=500, null=True, description="备份文件路径（关联文件管理）")
    file_uuid = fields.CharField(max_length=36, null=True, description="备份文件UUID（关联文件管理）")
    file_size = fields.BigIntField(null=True, description="备份文件大小（字节）")
    
    # 备份状态
    status = fields.CharField(max_length=20, description="备份状态（pending、running、success、failed）")
    inngest_run_id = fields.CharField(max_length=100, null=True, description="Inngest 运行ID（关联备份任务）")
    started_at = fields.DatetimeField(null=True, description="备份开始时间")
    completed_at = fields.DatetimeField(null=True, description="备份完成时间")
    error_message = fields.TextField(null=True, description="错误信息")
    
    # deleted_at 字段由 BaseModel 提供（软删除）
    
    class Meta:
        """
        模型元数据
        """
        table = "core_data_backups"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("backup_type",),
            ("backup_scope",),
            ("status",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"DataBackup(uuid={self.uuid}, name='{self.name}', status='{self.status}')"

