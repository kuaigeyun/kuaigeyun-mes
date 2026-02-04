"""
数据集模型模块

定义数据集数据模型，用于数据集管理。
统一后关联 IntegrationConfig（数据连接/数据源）。
"""

from tortoise import fields
from typing import Optional, Dict, Any, TYPE_CHECKING
from .base import BaseModel

if TYPE_CHECKING:
    from .integration_config import IntegrationConfig


class Dataset(BaseModel):
    """
    数据集模型
    
    用于定义和管理组织内的数据集，支持 SQL 查询和 API 查询。
    支持多组织隔离，每个组织的数据集相互独立。
    统一后通过 integration_config 关联数据连接/数据源（原 DataSource 已合并入 IntegrationConfig）。
    """
    id = fields.IntField(pk=True, description="数据集ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供

    integration_config: fields.ForeignKeyRelation["IntegrationConfig"] = fields.ForeignKeyField(
        "models.IntegrationConfig",
        related_name="datasets",
        description="关联集成配置/数据连接（统一数据源与数据连接）",
    )
    # integration_config_id 由 ForeignKeyField 自动创建

    name = fields.CharField(max_length=100, description="数据集名称")
    code = fields.CharField(max_length=50, description="数据集代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="数据集描述")
    
    query_type = fields.CharField(max_length=20, description="查询类型（sql、api）")
    query_config = fields.JSONField(description="查询配置（JSON格式）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    last_executed_at = fields.DatetimeField(null=True, description="最后执行时间")
    last_error = fields.TextField(null=True, description="最后执行错误信息")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_datasets"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("integration_config_id",),
            ("uuid",),
            ("code",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.query_type})"

