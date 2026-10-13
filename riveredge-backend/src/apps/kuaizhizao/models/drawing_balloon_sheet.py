"""图纸气泡标注单（独立于首件检验）"""

from tortoise import fields

from core.models.base import BaseModel


class DrawingBalloonSheet(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_drawing_balloon_sheets"
        table_description = "快格轻制造 - 图纸气泡标注单"
        indexes = [
            ("tenant_id",),
            ("sheet_code",),
            ("status",),
            ("linked_fai_order_id",),
        ]
        unique_together = [("tenant_id", "sheet_code")]

    id = fields.IntField(pk=True, description="主键ID")
    sheet_code = fields.CharField(max_length=50, description="标注单编码")
    title = fields.CharField(max_length=200, description="标题")
    status = fields.CharField(max_length=20, default="draft", description="draft/confirmed")

    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    drawing_no = fields.CharField(max_length=100, null=True, description="图纸号")
    drawing_revision = fields.CharField(max_length=50, null=True, description="图纸版本")
    work_order_id = fields.IntField(null=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单号")

    drawing_file_url = fields.CharField(max_length=500, null=True, description="图纸文件")
    balloon_candidates = fields.JSONField(null=True, description="OCR/气泡候选（待确认）")
    linked_fai_order_id = fields.IntField(null=True, description="关联首件单ID")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
