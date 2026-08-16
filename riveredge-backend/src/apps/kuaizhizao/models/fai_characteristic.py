"""FAI 特性行"""

from tortoise import fields

from core.models.base import BaseModel


class FaiCharacteristic(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_fai_characteristics"
        table_description = "快格轻制造 - FAI 特性明细"
        indexes = [
            ("tenant_id",),
            ("fai_order_id",),
            ("balloon_no",),
            ("sequence",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    fai_order_id = fields.IntField(description="FAI 单ID")
    sequence = fields.IntField(default=1, description="序号")
    balloon_no = fields.CharField(max_length=30, null=True, description="气泡号")
    characteristic_name = fields.CharField(max_length=200, description="特性名称")
    nominal_value = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="名义值")
    upper_tolerance = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="上差")
    lower_tolerance = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="下差")
    unit = fields.CharField(max_length=20, null=True, description="单位")
    measured_value = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="实测值")
    sample_values = fields.JSONField(null=True, description="多样本实测值列表")
    judgment = fields.CharField(max_length=20, default="pending", description="pending/pass/fail/na")
    gauge_id = fields.IntField(null=True, description="量具ID")
    gauge_code = fields.CharField(max_length=50, null=True, description="量具编码")
    gauge_name = fields.CharField(max_length=100, null=True, description="量具名称")
    source_step_key = fields.CharField(max_length=50, null=True, description="来源方案步骤")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
