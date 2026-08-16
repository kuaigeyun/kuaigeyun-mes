"""用章申请模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaSealRequest(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    request_code = fields.CharField(max_length=50, description="申请单号")
    title = fields.CharField(max_length=200, description="标题")
    seal_type = fields.CharField(max_length=30, description="印章类型")
    document_name = fields.CharField(max_length=200, description="文件名称")
    copies = fields.IntField(default=1, description="份数")
    take_out = fields.BooleanField(default=False, description="是否外带")
    source_app = fields.CharField(max_length=50, null=True, description="来源应用")
    source_entity_type = fields.CharField(max_length=50, null=True, description="来源实体类型")
    source_entity_id = fields.IntField(null=True, description="来源实体ID")
    source_doc_no = fields.CharField(max_length=100, null=True, description="来源单号")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    applicant_id = fields.IntField(null=True, description="申请人")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="申请部门")
    notes = fields.TextField(null=True, description="备注")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_seal_requests"
        table_description = "轻办公 - 用章申请"
        unique_together = (("tenant_id", "request_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "applicant_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]
