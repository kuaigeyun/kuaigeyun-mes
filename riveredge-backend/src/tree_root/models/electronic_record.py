"""
电子记录模型模块

定义电子记录数据模型，用于电子记录管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class ElectronicRecord(BaseModel):
    """
    电子记录模型
    
    用于定义和管理组织内的电子记录，支持签名、归档等生命周期管理。
    所有签名、归档流程都通过 Inngest 工作流执行。
    支持多组织隔离，每个组织的电子记录相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="电子记录ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 记录基本信息
    name = fields.CharField(max_length=200, description="记录名称")
    code = fields.CharField(max_length=50, description="记录代码（唯一，用于程序识别）")
    type = fields.CharField(max_length=50, description="记录类型")
    description = fields.TextField(null=True, description="记录描述")
    
    # 记录内容
    content = fields.JSONField(description="记录内容（JSON格式）")
    
    # 关联文件
    file_uuid = fields.CharField(max_length=36, null=True, description="关联文件UUID（可选）")
    
    # Inngest 关联
    inngest_workflow_id = fields.CharField(max_length=100, null=True, description="Inngest 工作流ID（签名、归档流程）")
    inngest_run_id = fields.CharField(max_length=100, null=True, description="Inngest 运行ID（当前工作流实例）")
    
    # 记录状态
    status = fields.CharField(max_length=20, default="draft", description="记录状态（draft、signed、archived、destroyed）")
    lifecycle_stage = fields.CharField(max_length=20, null=True, description="生命周期阶段（created、signing、archiving、completed）")
    
    # 签名信息
    signer_id = fields.IntField(null=True, description="签名人ID")
    signed_at = fields.DatetimeField(null=True, description="签名时间")
    signature_data = fields.TextField(null=True, description="签名数据（可选）")
    
    # 归档信息
    archived_at = fields.DatetimeField(null=True, description="归档时间")
    archive_location = fields.CharField(max_length=200, null=True, description="归档位置（可选）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_electronic_records"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("uuid",),
            ("code",),
            ("type",),
            ("status",),
            ("lifecycle_stage",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.status})"

