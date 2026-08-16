"""总账项目（辅助核算字典）"""

from tortoise import fields

from core.models.base import BaseModel


class GlProject(BaseModel):
    class Meta:
        table = "apps_kuaicaiwu_gl_projects"
        table_description = "总账 - 项目辅助字典"
        unique_together = (("tenant_id", "project_code"),)

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(description="租户ID")
    project_code = fields.CharField(max_length=64, description="项目编码")
    project_name = fields.CharField(max_length=200, description="项目名称")
    is_active = fields.BooleanField(default=True, description="是否启用")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
