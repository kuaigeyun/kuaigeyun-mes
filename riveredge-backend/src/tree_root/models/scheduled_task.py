"""
定时任务模型模块

定义定时任务数据模型，用于定时任务管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class ScheduledTask(BaseModel):
    """
    定时任务模型
    
    用于定义和管理组织内的定时任务，所有任务都通过 Inngest 执行。
    支持多组织隔离，每个组织的定时任务相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="定时任务ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    name = fields.CharField(max_length=100, description="任务名称")
    code = fields.CharField(max_length=50, description="任务代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="任务描述")
    type = fields.CharField(max_length=20, description="任务类型（python_script、api_call等）")
    
    trigger_type = fields.CharField(max_length=20, description="触发器类型（cron、interval、date）")
    trigger_config = fields.JSONField(description="触发器配置（JSON格式）")
    
    task_config = fields.JSONField(description="任务配置（JSON格式）")
    
    # Inngest 关联
    inngest_function_id = fields.CharField(max_length=100, null=True, description="Inngest 函数ID（关联 Inngest 函数）")
    
    # 任务状态
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_running = fields.BooleanField(default=False, description="是否正在运行")
    last_run_at = fields.DatetimeField(null=True, description="最后运行时间")
    last_run_status = fields.CharField(max_length=20, null=True, description="最后运行状态（success、failed）")
    last_error = fields.TextField(null=True, description="最后错误信息")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_scheduled_tasks"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("type",),
            ("trigger_type",),
            ("uuid",),
            ("code",),
            ("is_active",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.trigger_type})"

