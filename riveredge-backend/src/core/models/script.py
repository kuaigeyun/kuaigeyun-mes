"""
脚本管理模型模块

定义脚本数据模型，用于脚本管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class Script(BaseModel):
    """
    脚本模型
    
    用于定义和管理组织内的脚本，支持多种脚本类型（Python、Shell、SQL等）。
    脚本执行可以通过 Inngest 异步执行（可选）。
    支持多组织隔离，每个组织的脚本相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="脚本ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 脚本基本信息
    name = fields.CharField(max_length=200, description="脚本名称")
    code = fields.CharField(max_length=50, description="脚本代码（唯一，用于程序识别）")
    type = fields.CharField(max_length=50, description="脚本类型（python、shell、sql等）")
    description = fields.TextField(null=True, description="脚本描述")
    
    # 脚本内容
    content = fields.TextField(description="脚本内容")
    
    # 脚本配置
    config = fields.JSONField(null=True, description="脚本配置（JSON格式，如参数、环境变量等）")
    
    # Inngest 关联（可选）
    inngest_function_id = fields.CharField(max_length=100, null=True, description="Inngest 函数ID（如果通过 Inngest 执行）")
    
    # 脚本状态
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_running = fields.BooleanField(default=False, description="是否正在运行")
    
    # 执行信息
    last_run_at = fields.DatetimeField(null=True, description="最后执行时间")
    last_run_status = fields.CharField(max_length=20, null=True, description="最后执行状态（success、failed、running）")
    last_error = fields.TextField(null=True, description="最后执行错误信息")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_scripts"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("uuid",),
            ("code",),
            ("type",),
            ("is_active",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.type})"

