"""
审批流程模型模块

定义审批流程数据模型，用于审批流程管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class ApprovalProcess(BaseModel):
    """
    审批流程模型
    
    用于定义和管理组织内的审批流程，支持多组织隔离。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="审批流程ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    name = fields.CharField(max_length=100, description="流程名称")
    code = fields.CharField(max_length=50, description="流程代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="流程描述")
    
    # 流程配置
    nodes = fields.JSONField(description="流程节点配置（JSON格式，ProFlow 设计）")
    config = fields.JSONField(description="流程配置（JSON格式）")
    
    # 流程状态
    is_active = fields.BooleanField(default=True, description="是否启用")

    version = fields.IntField(default=1, description="流程版本（发布后递增）")
    published_version = fields.IntField(default=1, description="已发布版本号")
    draft_nodes = fields.JSONField(null=True, description="草稿节点（未发布编辑）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_approval_processes"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("uuid",),
            ("code",),
            ("is_active",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

