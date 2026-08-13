"""
文件预览批注（与源 CAD/PCB 文件分离存储）
"""

from tortoise import fields

from core.models.base import BaseModel


class FilePreviewMarkup(BaseModel):
    """按 file_uuid + scope 存 SVG 视图批注 JSON，不修改 core_files 二进制。"""

    class Meta:
        table = "core_file_preview_markups"
        table_description = "文件预览批注"
        unique_together = [("tenant_id", "file_uuid", "scope")]
        indexes = [
            ("tenant_id",),
            ("file_uuid",),
        ]

    id = fields.IntField(pk=True)
    file_uuid = fields.CharField(max_length=36, description="core_files.uuid")
    scope = fields.CharField(
        max_length=32,
        default="default",
        description="批注视图范围：default / top / bottom（PCB 双面）",
    )
    payload = fields.JSONField(description="批注形状 JSON")
    # updated_by / created_by* / updated_by_name 继承自 BaseModel
