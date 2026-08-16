"""审批表单模板模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaFormTemplate(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    template_code = fields.CharField(max_length=50, description="模板编码")
    template_name = fields.CharField(max_length=200, description="模板名称")
    category = fields.CharField(max_length=50, default="general", description="分类")
    description = fields.TextField(null=True, description="说明")
    fields_schema = fields.JSONField(default=list, description="字段定义 JSON")
    is_active = fields.BooleanField(default=True, description="是否启用")
    show_in_menu = fields.BooleanField(default=False, description="是否挂到自定义审批菜单分组")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_form_templates"
        table_description = "轻办公 - 审批表单模板"
        unique_together = (("tenant_id", "template_code"),)
        indexes = [("tenant_id", "category"), ("tenant_id", "is_active")]

    class PydanticMeta:
        exclude = ["deleted_at"]
