"""工程图纸打印水印策略"""

from tortoise import fields

from core.models.base import BaseModel

DRAWING_WATERMARK_POSITIONS = frozenset(
    {"diagonal", "center", "topLeft", "topRight", "bottomLeft", "bottomRight"}
)
DEFAULT_DRAWING_WATERMARK_TEMPLATE = "{user} {time} {code}-{revision} {securityLevel}"


class DrawingWatermarkPolicy(BaseModel):
    class Meta:
        table = "apps_master_data_drawing_watermark_policies"
        table_description = "基础数据管理 - 图纸打印水印策略"
        indexes = [("tenant_id",)]

    id = fields.IntField(pk=True, description="主键ID")
    is_enabled = fields.BooleanField(default=True, description="启用打印水印")
    force_on_print = fields.BooleanField(default=True, description="启用后打印须带水印文案")
    opacity = fields.FloatField(default=0.15, description="水印透明度 0.05-0.5")
    angle = fields.IntField(default=-25, description="旋转角度（度）")
    font_size = fields.IntField(default=48, description="字号 px")
    color = fields.CharField(max_length=32, default="rgba(200,0,0,1)", description="水印颜色")
    position = fields.CharField(
        max_length=20,
        default="diagonal",
        description="diagonal/center/topLeft/topRight/bottomLeft/bottomRight",
    )
    template_public = fields.TextField(
        null=True,
        description="公开密级水印模板",
    )
    template_internal = fields.TextField(
        null=True,
        description="内部密级水印模板",
    )
    template_secret = fields.TextField(
        null=True,
        description="秘密密级水印模板",
    )
    template_confidential = fields.TextField(
        null=True,
        description="机密密级水印模板",
    )
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")
