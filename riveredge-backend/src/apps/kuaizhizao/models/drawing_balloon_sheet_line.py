"""图纸气泡标注特性行"""

from tortoise import fields

from core.models.base import BaseModel


class DrawingBalloonSheetLine(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_drawing_balloon_sheet_lines"
        table_description = "快格轻制造 - 图纸气泡标注特性行"
        indexes = [
            ("tenant_id",),
            ("sheet_id",),
            ("balloon_no",),
            ("sequence",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    sheet_id = fields.IntField(description="标注单ID")
    sequence = fields.IntField(default=1, description="序号")
    balloon_no = fields.CharField(max_length=30, null=True, description="气泡号")
    characteristic_name = fields.CharField(max_length=200, description="特性名称")
    nominal_value = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="名义值")
    upper_tolerance = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="上差")
    lower_tolerance = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="下差")
    unit = fields.CharField(max_length=20, null=True, description="单位")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
