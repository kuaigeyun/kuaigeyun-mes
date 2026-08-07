"""通用审批申请单模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaFormRequest(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    request_code = fields.CharField(max_length=50, description="申请单号")
    template_id = fields.IntField(null=True, description="模板ID")
    template_code = fields.CharField(max_length=50, null=True, description="模板编码")
    title = fields.CharField(max_length=200, description="标题")
    form_data = fields.JSONField(default=dict, description="表单数据")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    applicant_id = fields.IntField(null=True, description="申请人")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="申请部门")
    notes = fields.TextField(null=True, description="备注")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_form_requests"
        table_description = "轻办公 - 通用审批申请单"
        unique_together = (("tenant_id", "request_code"),)
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "template_id"),
            ("tenant_id", "applicant_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
