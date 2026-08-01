"""安装执行单任务明细。"""

from tortoise import fields

from core.models.base import BaseModel


class InstallExecutionTask(BaseModel):
    """安装执行任务行（含现场照片）"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    job_id = fields.IntField(description="安装执行单ID")

    line_no = fields.IntField(default=1, description="行号")
    stage_key = fields.CharField(max_length=50, description="所属阶段键")
    task_title = fields.CharField(max_length=200, description="任务标题")

    executor_id = fields.IntField(null=True, description="执行人ID")
    executor_name = fields.CharField(max_length=100, null=True, description="执行人姓名")

    # 待处理 / 进行中 / 已完成
    status = fields.CharField(max_length=20, default="待处理", description="任务状态")
    planned_at = fields.DatetimeField(null=True, description="计划时间")
    actual_at = fields.DatetimeField(null=True, description="实际完成时间")
    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="现场照片附件")

    class Meta:
        table = "apps_kuaizhizao_install_execution_tasks"
        table_description = "快格轻制造 - 安装执行任务"
        indexes = [
            ("tenant_id", "job_id"),
            ("tenant_id", "job_id", "stage_key"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
