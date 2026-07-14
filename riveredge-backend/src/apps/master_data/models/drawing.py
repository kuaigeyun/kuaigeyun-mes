"""
工程图纸模型模块

PLM 风格图纸台账：元数据与关联对象存业务表，文件二进制存 core_files（通过 UUID 引用）。
"""

from tortoise import fields

from core.models.base import BaseModel


class EngineeringDrawing(BaseModel):
    """工程图纸台账"""

    class Meta:
        table = "apps_master_data_engineering_drawings"
        table_description = "基础数据管理 - 工程图纸"
        unique_together = [("tenant_id", "code", "revision")]
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("code",),
            ("status",),
            ("drawing_type",),
            ("created_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")

    code = fields.CharField(max_length=50, description="图号")
    name = fields.CharField(max_length=200, description="图纸名称")
    revision = fields.CharField(max_length=20, default="A", description="修订版")
    drawing_type = fields.CharField(
        max_length=20,
        default="part",
        description="类型：part/assembly/process/other",
    )
    status = fields.CharField(
        max_length=20,
        default="Draft",
        description="状态：Draft/Released/Obsolete",
    )

    file_uuid = fields.CharField(max_length=36, description="主文件 UUID（core_files）")
    supplementary_file_uuids = fields.JSONField(
        null=True,
        description="附加页文件 UUID 列表",
    )
    material_uuids = fields.JSONField(null=True, description="关联物料 UUID 列表")
    process_route_uuids = fields.JSONField(null=True, description="关联工艺路线 UUID 列表")
    operation_uuids = fields.JSONField(null=True, description="关联工序 UUID 列表")
    description = fields.TextField(null=True, description="备注")

    linked_bom_material_id = fields.IntField(null=True, description="关联 BOM 根物料 ID")
    linked_bom_version = fields.CharField(max_length=50, null=True, description="关联 BOM 版本")
    last_step_bom_import_at = fields.DatetimeField(null=True, description="最近 STP 导入 BOM 时间")

    released_at = fields.DatetimeField(null=True, description="发布时间")
    released_by = fields.IntField(null=True, description="发布人 ID")
    obsolete_at = fields.DatetimeField(null=True, description="作废时间")
    obsolete_reason = fields.TextField(null=True, description="作废原因")

    deleted_at = fields.DatetimeField(null=True, description="软删除时间")

    def __str__(self) -> str:
        return f"{self.code}-{self.revision} {self.name}"
