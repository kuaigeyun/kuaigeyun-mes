"""
异常处理记录数据模型模块

定义异常处理记录数据模型，用于记录异常处理流程的历史。

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import fields
from core.models.base import BaseModel


class ExceptionProcessRecord(BaseModel):
    """
    异常处理记录模型

    用于记录异常处理流程的历史，支持缺料异常、延期异常、质量异常的处理流程。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        exception_type: 异常类型（material_shortage/delivery_delay/quality）
        exception_id: 异常记录ID（关联MaterialShortageException/DeliveryDelayException/QualityException）
        process_status: 处理流程状态（pending/processing/resolved/cancelled）
        current_step: 当前步骤（detected/assigned/investigating/handling/verifying/closed）
        assigned_to: 分配给（用户ID）
        assigned_to_name: 分配给（用户名）
        assigned_at: 分配时间
        inngest_run_id: Inngest运行ID（关联Inngest工作流实例）
        process_config: 流程配置（JSON格式，用于自定义流程步骤）
        started_at: 开始时间
        completed_at: 完成时间
        remarks: 备注
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_exception_process_records"
        table_description = "快格轻制造 - 异常处理记录"
        indexes = [
            ("tenant_id",),
            ("exception_type",),
            ("exception_id",),
            ("process_status",),
            ("current_step",),
            ("assigned_to",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 异常类型和关联信息
    exception_type = fields.CharField(max_length=50, description="异常类型")
    exception_id = fields.IntField(description="异常记录ID")

    # 处理流程状态
    process_status = fields.CharField(max_length=20, default="pending", description="处理流程状态")
    current_step = fields.CharField(max_length=50, default="detected", description="当前步骤")

    # 分配信息
    assigned_to = fields.IntField(null=True, description="分配给（用户ID）")
    assigned_to_name = fields.CharField(max_length=100, null=True, description="分配给（用户名）")
    assigned_at = fields.DatetimeField(null=True, description="分配时间")

    # Inngest工作流关联
    inngest_run_id = fields.CharField(max_length=100, null=True, description="Inngest运行ID")

    # 流程配置（用于自定义流程步骤）
    process_config = fields.JSONField(null=True, description="流程配置（JSON格式）")

    # 时间信息
    started_at = fields.DatetimeField(null=True, description="开始时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.exception_type} - {self.exception_id} ({self.process_status})"


class ExceptionProcessHistory(BaseModel):
    """
    异常处理历史记录模型

    用于记录异常处理流程的每次操作历史，支持流程追踪。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        process_record_id: 处理记录ID（关联ExceptionProcessRecord）
        action: 操作类型（start/assign/step_transition/resolve/cancel）
        action_by: 操作人ID
        action_by_name: 操作人姓名
        action_at: 操作时间
        from_step: 来源步骤
        to_step: 目标步骤
        comment: 操作说明
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_exception_process_histories"
        table_description = "快格轻制造 - 异常处理历史"
        indexes = [
            ("tenant_id",),
            ("process_record_id",),
            ("action",),
            ("action_by",),
            ("action_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联处理记录
    process_record_id = fields.IntField(description="处理记录ID")

    # 操作信息
    action = fields.CharField(max_length=50, description="操作类型")
    action_by = fields.IntField(description="操作人ID")
    action_by_name = fields.CharField(max_length=100, description="操作人姓名")
    action_at = fields.DatetimeField(description="操作时间")

    # 步骤流转信息
    from_step = fields.CharField(max_length=50, null=True, description="来源步骤")
    to_step = fields.CharField(max_length=50, null=True, description="目标步骤")

    # 操作说明
    comment = fields.TextField(null=True, description="操作说明")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.action} by {self.action_by_name} at {self.action_at}"
