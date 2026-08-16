"""质量体系 - ISO 条款目录"""

from tortoise import fields

from core.models.base import BaseModel


class QmsIsoClause(BaseModel):
    class Meta:
        table = "apps_kuaizhizao_qms_iso_clauses"
        table_description = "快格轻制造 - 质量体系 ISO 条款"
        indexes = [
            ("tenant_id",),
            ("standard_code",),
            ("clause_code",),
            ("parent_id",),
            ("is_active",),
        ]
        unique_together = [("tenant_id", "standard_code", "clause_code")]

    id = fields.IntField(pk=True, description="主键ID")
    standard_code = fields.CharField(max_length=30, description="标准编码，如 ISO9001:2015")
    clause_code = fields.CharField(max_length=30, description="条款号，如 8.5.1")
    title = fields.CharField(max_length=200, description="条款标题")
    description = fields.TextField(null=True, description="说明")
    parent_id = fields.IntField(null=True, description="父条款ID")
    sort_order = fields.IntField(default=0, description="排序")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")
