"""
数据备份模型模块

定义数据备份数据模型，用于记录系统和组织的备份历史。
"""

from tortoise import fields
from core.models.base import BaseModel


class DataBackup(BaseModel):
    """
    数据备份模型
    
    用于记录数据库和文件系统的备份任务及其状态。
    
    Attributes:
        id: 主键ID
        uuid: 业务ID (BaseModel)
        tenant_id: 组织ID (BaseModel)
        name: 备份名称
        backup_type: 备份类型 (full: 全量, incremental: 增量)
        backup_scope: 备份范围 (all: 全部, tenant: 组织, table: 表)
        backup_tables: 备份的表列表 (JSON 格式)
        file_path: 备份文件路径
        file_uuid: 关联的文件ID (若已上传至文件系统)
        file_size: 文件大小 (字节)
        status: 任务状态 (pending, running, success, failed)
        inngest_run_id: 关联的 Inngest 运行 ID
        started_at: 开始时间
        completed_at: 完成时间
        error_message: 错误信息
    """
    
    class Meta:
        table = "core_data_backups"
        indexes = [
            ("tenant_id", "status"),
            ("uuid",),
            ("status",),
        ]
        
    id = fields.IntField(pk=True, description="主键ID")
    
    name = fields.CharField(max_length=200, description="备份名称")
    backup_type = fields.CharField(max_length=20, default="full", description="备份类型")
    backup_scope = fields.CharField(max_length=20, default="all", description="备份范围")
    backup_tables = fields.JSONField(null=True, description="备份的表列表")
    
    file_path = fields.CharField(max_length=500, null=True, description="备份文件本地路径")
    file_uuid = fields.CharField(max_length=100, null=True, description="文件UUID")
    file_size = fields.BigIntField(null=True, description="文件大小")
    
    status = fields.CharField(max_length=20, default="pending", description="备份状态")
    inngest_run_id = fields.CharField(max_length=100, null=True, description="Inngest 运行ID")
    
    started_at = fields.DatetimeField(null=True, description="开始时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    error_message = fields.TextField(null=True, description="错误信息")
    
    def __str__(self):
        return f"Backup {self.name} ({self.status})"
