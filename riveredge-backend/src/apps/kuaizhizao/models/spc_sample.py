"""
SPC 采样数据模型
"""

from tortoise import fields

from core.models.base import BaseModel


class SPCSample(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_spc_samples"
        table_description = "快格轻制造 - SPC 采样数据"
        indexes = [
            ("tenant_id",),
            ("characteristic_name",),
            ("chart_type",),
            ("sample_time",),
            ("source_type", "source_id"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    chart_type = fields.CharField(max_length=20, default="imr", description="控制图类型")
    characteristic_name = fields.CharField(max_length=100, description="质量特性名称")
    sample_time = fields.DatetimeField(description="采样时间")
    sample_value = fields.DecimalField(max_digits=18, decimal_places=6, description="采样值")
    sample_size = fields.IntField(default=1, description="样本量")
    sample_group = fields.CharField(max_length=50, null=True, description="样本组")
    source_type = fields.CharField(max_length=30, null=True, description="来源类型")
    source_id = fields.IntField(null=True, description="来源ID")
    source_code = fields.CharField(max_length=50, null=True, description="来源编码")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
