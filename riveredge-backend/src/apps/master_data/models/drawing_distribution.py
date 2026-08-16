"""图档发放单与发放控制策略"""

from tortoise import fields

from core.models.base import BaseModel


class DrawingDistributionPolicy(BaseModel):
    class Meta:
        table = "apps_master_data_drawing_distribution_policies"
        table_description = "基础数据管理 - 图档发放控制"
        indexes = [("tenant_id",)]

    id = fields.IntField(pk=True, description="主键ID")
    is_enabled = fields.BooleanField(default=False, description="启用后车间只读已发放未收回版")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")


class DrawingDistribution(BaseModel):
    class Meta:
        table = "apps_master_data_drawing_distributions"
        table_description = "基础数据管理 - 图档发放单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("status",),
            ("created_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    code = fields.CharField(max_length=50, description="发放单号")
    name = fields.CharField(max_length=200, description="发放单名称")
    status = fields.CharField(
        max_length=20,
        default="Draft",
        description="Draft/Pending/Issued/Recalled",
    )
    remark = fields.TextField(null=True, description="备注")
    issued_at = fields.DatetimeField(null=True, description="发放时间")
    issued_by = fields.IntField(null=True, description="发放人ID")
    issued_by_name = fields.CharField(max_length=100, null=True, description="发放人姓名")
    recalled_at = fields.DatetimeField(null=True, description="收回时间")
    recalled_by = fields.IntField(null=True, description="收回人ID")
    recalled_by_name = fields.CharField(max_length=100, null=True, description="收回人姓名")
    recall_reason = fields.TextField(null=True, description="收回原因")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")


class DrawingDistributionLine(BaseModel):
    class Meta:
        table = "apps_master_data_drawing_distribution_lines"
        table_description = "基础数据管理 - 图档发放明细"
        indexes = [
            ("tenant_id",),
            ("distribution_id",),
            ("drawing_id",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    distribution_id = fields.IntField(description="发放单ID")
    drawing_id = fields.IntField(description="图纸ID")
    drawing_uuid = fields.CharField(max_length=36, description="图纸UUID")
    drawing_code = fields.CharField(max_length=50, description="图号")
    drawing_name = fields.CharField(max_length=200, description="图纸名称")
    drawing_revision = fields.CharField(max_length=20, description="修订版")
