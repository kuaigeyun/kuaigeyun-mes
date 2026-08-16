"""公告通知模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaAnnouncement(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    announcement_code = fields.CharField(max_length=50, description="公告编号")
    title = fields.CharField(max_length=200, description="标题")
    content = fields.TextField(description="正文")
    scope_type = fields.CharField(max_length=30, default="all", description="范围类型")
    scope_department = fields.CharField(max_length=100, null=True, description="部门范围")
    is_pinned = fields.BooleanField(default=False, description="置顶")
    effective_at = fields.DatetimeField(null=True, description="生效时间")
    expires_at = fields.DatetimeField(null=True, description="过期时间")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    publisher_id = fields.IntField(null=True, description="发布人")
    publisher_name = fields.CharField(max_length=100, null=True, description="发布人姓名")
    published_at = fields.DatetimeField(null=True, description="发布时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_announcements"
        table_description = "轻办公 - 公告通知"
        unique_together = (("tenant_id", "announcement_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "is_pinned")]

    class PydanticMeta:
        exclude = ["deleted_at"]
