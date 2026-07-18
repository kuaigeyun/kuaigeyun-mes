"""
工位机人脸特征模板（仅存 descriptor，不存照片）
"""

from tortoise import fields

from infra.models.base import BaseModel


class UserFaceTemplate(BaseModel):
    """用户人脸特征向量模板"""

    class Meta:
        table = "core_user_face_templates"
        table_description = "用户人脸特征模板（工位终端生物识别）"
        app = "models"
        indexes = [
            ("tenant_id",),
            ("user_id",),
            ("tenant_id", "user_id"),
        ]

    tenant_id = fields.IntField(description="租户ID")
    user = fields.ForeignKeyField(
        "models.User",
        related_name="face_templates",
        on_delete=fields.CASCADE,
        description="关联用户",
    )
    descriptor = fields.JSONField(description="人脸特征向量（float 数组）")
    quality = fields.FloatField(null=True, description="采集质量分")
    device_info = fields.CharField(max_length=255, null=True, description="采集设备信息")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self) -> str:
        return f"<UserFaceTemplate(id={self.id}, user_id={self.user_id})>"
