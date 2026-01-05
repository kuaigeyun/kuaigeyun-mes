"""
上线倒计时模型模块

提供上线倒计时数据模型定义，用于管理上线倒计时配置和导入进度。

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class LaunchCountdown(BaseModel):
    """
    上线倒计时模型
    
    用于管理上线倒计时配置和导入进度跟踪。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        launch_date: 上线日期
        snapshot_time: 快照时间点（期初数据的基准时间点）
        status: 状态（pending/in_progress/completed/cancelled）
        progress: 导入进度（JSON格式存储）
        notes: 备注
        created_by: 创建人ID
        updated_by: 更新人ID
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_launch_countdowns"
        indexes = [
            ("tenant_id",),
            ("launch_date",),
            ("status",),
            ("uuid",),
        ]
        unique_together = [("tenant_id", "status")]  # 每个组织只能有一个进行中的倒计时
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    launch_date = fields.DatetimeField(description="上线日期")
    snapshot_time = fields.DatetimeField(null=True, description="快照时间点（期初数据的基准时间点）")
    
    # 状态信息
    status = fields.CharField(max_length=20, default="pending", description="状态（pending/in_progress/completed/cancelled）")
    
    # 进度信息（JSON格式存储）
    progress = fields.JSONField(null=True, description="导入进度（JSON格式，存储各阶段导入状态）")
    
    # 备注
    notes = fields.TextField(null=True, description="备注")
    
    # 创建人和更新人
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"上线倒计时 - {self.launch_date.strftime('%Y-%m-%d') if self.launch_date else '未设置'}"

