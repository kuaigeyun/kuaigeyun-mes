"""安装执行单阶段。"""

from tortoise import fields

from core.models.base import BaseModel


class InstallExecutionStage(BaseModel):
    """安装执行阶段（进度真源）"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    job_id = fields.IntField(description="安装执行单ID")

    stage_key = fields.CharField(max_length=50, description="阶段键")
    stage_name = fields.CharField(max_length=100, description="阶段名称")
    sort_order = fields.IntField(default=1, description="排序")

    # 待开始 / 进行中 / 已完成
    status = fields.CharField(max_length=20, default="待开始", description="阶段状态")
    planned_at = fields.DatetimeField(null=True, description="计划完成时间")
    actual_at = fields.DatetimeField(null=True, description="实际完成时间")
    notes = fields.TextField(null=True, description="阶段备注")

    class Meta:
        table = "apps_kuaizhizao_install_execution_stages"
        table_description = "快格轻制造 - 安装执行阶段"
        indexes = [
            ("tenant_id", "job_id"),
            ("tenant_id", "job_id", "stage_key"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
