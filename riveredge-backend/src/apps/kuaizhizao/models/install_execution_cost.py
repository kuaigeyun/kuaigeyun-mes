"""安装执行单费用明细。"""

from tortoise import fields

from core.models.base import BaseModel


class InstallExecutionCost(BaseModel):
    """安装执行费用行"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    job_id = fields.IntField(description="安装执行单ID")

    line_no = fields.IntField(default=1, description="行号")
    # 人工 / 差旅 / 外协 / 物料
    cost_type = fields.CharField(max_length=20, description="费用类型")
    amount = fields.DecimalField(max_digits=14, decimal_places=2, description="金额")
    occurred_at = fields.DatetimeField(description="发生时间")
    description = fields.CharField(max_length=500, null=True, description="说明")

    class Meta:
        table = "apps_kuaizhizao_install_execution_costs"
        table_description = "快格轻制造 - 安装执行费用"
        indexes = [
            ("tenant_id", "job_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
